import { Router } from "express";
import {login,logout} from "../controller/authController.js";
const authRouter = Router();


authRouter.post("/login", login);
authRouter.post("/logout",logout);
// authRouter.post("/resetpassword",resetpassword)
export default authRouter;