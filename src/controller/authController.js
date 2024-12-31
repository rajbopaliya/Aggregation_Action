import { handlePrismaSuccess,handlePrismaError } from "../services/prismaResponseHandler.js";
import { UserResponseCodes,PasswordPolicy,ResponseCodes } from "../../constant.js";
import { decrypt, encrypt } from "../services/encryptDecrypt.js";
import prisma from "../../DB/db.config.js";
import pkg from 'jsonwebtoken';
const {sign} = pkg;

const login = async (request, res) => {
  const { userId, password, forceFully = false } = request.body;
  console.log("aa");
  
  console.log(request.body);
  
  try {
    // Fetch user by userId
    const user = await findByUserId(userId);

    if (!user) {
      handlePrismaError(
        res,
        undefined,
        "Invalid username or password",
        UserResponseCodes.USER_NOT_FOUND
      );
      return;
    }

    if (!user.is_active) {
      handlePrismaError(
        res,
        undefined,
        "User is deleted",
        UserResponseCodes.USER_DELETED_ERROR
      );
      return;
    }

    const currentDate = new Date();
    const lockTime = new Date().setMinutes(
      currentDate.getMinutes() + PasswordPolicy.ACCOUNT_lOCK_TIME
    );

    // Check if account is locked
    if (user.account_locked_until_at > currentDate) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failed_login_attempt_count: 0 },
      });
      handlePrismaError(
        res,
        undefined,
        `Account is locked until ${user.account_locked_until_at}`,
        ResponseCodes.ACCOUNT_LOCKED_ERROR
      );
      return;
    }

    // Handle too many failed login attempts
    if (user.failed_login_attempt_count >= PasswordPolicy.MAX_LOGIN_ATTEMPT) {
      await prisma.user.update({
        where: { id: user.id },
        data: { account_locked_until_at: new Date(lockTime) },
      });
      handlePrismaError(
        res,
        undefined,
        "Too many failed login attempts. Please try again later.",
        ResponseCodes.TOO_MANY_REQUEST
      );
      return;
    }

// Verify password
    const originalPassword = await decrypt(user.password);    
    if (originalPassword !== password) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_attempt_count: user.failed_login_attempt_count + 1,
          last_failed_login_at: new Date(),
        },
      });
      handlePrismaError(
        res,
        undefined,
        "Invalid username or password",
        UserResponseCodes.USER_PASSWORD_MATCH_ERROR
      );
      return; 
    }
// Check for expired password
    if (user.password_expires_on && user.password_expires_on < currentDate) {
      handlePrismaError(
        res,
        undefined,
        "Password expired, please reset your password",
        ResponseCodes.UNAUTHORIZED
      );
      return;
    }

    const checker = await prisma.superadmin_configuration.findMany();
// Ensure user is not already logged in
    if (user.jwt_token !== null && !forceFully) {
      handlePrismaError(
        res,
        undefined,
        "User is already logged in, please logout and login again",
        UserResponseCodes.USER_ALREADY_EXIST
      );
      return;
    }
    const token = sign(
      {
        userId: user.id,
        role: user.role,
        userName: user.user_name,
        config: checker[0],
      },
      process.env.encryptDecryptKey,
      {
        expiresIn: PasswordPolicy.TOKEN_EXPIRE_TIME,
      }
    );

    const loginRes = await prisma.user.update({
      where: { id: user.id },
      data: {
        jwt_token: token,
        last_activity_at: new Date(),
        last_failed_login_at: null,
        account_locked_until_at: null,
        failed_login_attempt_count: 0,
      },
      include: {
        department: true
      }
    });

    console.log("loginRes", loginRes);
    console.log("login successful");

    handlePrismaSuccess(res, "Login successful", {
      token,
      accessibility: loginRes.accessibility,
      userName: loginRes.user_name,
      departmentName: loginRes?.department?.department_name ?? "Admin",
      email: loginRes.email,
      profile_image: loginRes.profile_photo,
    });
  } catch (error) {
    console.log("Error in login ", error);
    handlePrismaError(
      res,
      undefined,
      "Invalid username or password",
      UserResponseCodes.USER_PASSWORD_MATCH_ERROR
    );
  }
};

const findByUserId = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        user_id: true,
        user_name: true,
        email: true,
        phone_number: true,
        password: true,
        location_id: true,
        department_id: true,
        designation_id: true,
        profile_photo: true,
        esign_status: true,
        is_active: true,
        role: true,
        jwt_token: true,
        last_activity_at: true,
        password_expires_on: true,
        old_passwords: true,
        failed_login_attempt_count: true,
        last_failed_login_at: true,
        account_locked_until_at: true,
        department: {
          select: {
            id: true,
            department_id: true,
            department_name: true,
            is_location_required: true,
          },
        },
        // Add similar selection if designations or other relations are needed
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
  }
};


const logout = async (request, res) => {

  const token = request.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
  console.log(token);
  console.log(request.headers);
  console.log("logggg");
  
  
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    // Decode the token to get the user ID
    const decoded = pkg.verify(token, process.env.encryptDecryptKey); // Use your secret key here
    const userId = decoded.userId;     

    // Log the extracted user ID
    console.log(userId);


    // Update the user data in the database
    await prisma.user.update({
      where: { id: userId },
      data: {
        jwt_token: null,
        last_activity_at: new Date(),
      },
    });

    handlePrismaSuccess(res, "Logout successful");
    console.log("Logout successful");
    
  } catch (err) {
    console.error("Logout failed", err);
    handlePrismaError(
      res,
      undefined,
      "Logout failed",
      ResponseCodes.BAD_REQUEST
    );
  }
};

export {login,logout}