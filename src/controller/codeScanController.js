import prisma from "../../DB/db.config.js";
import codeValid from "../validation/codeScanValidation.js";
import { ResponseCodes } from "../../constant.js";
import { handlePrismaError,handlePrismaSuccess } from "../services/prismaResponseHandler.js";
const scanValidation = async (req, res) => {
  
  try {
  console.log(req.body);
  const validation = await codeValid.validateAsync(req.body);
  console.log(validation);
    console.log("uniqueCode:", validation.uniqueCode);
    console.log("productId:", validation.productId);
    console.log("BatchId", validation.batchId);
    
    //1.
    // Fetch the productCodeLength from superadmin configuration table
    const productConfig = await prisma.superadmin_configuration.findFirst();

    if (!productConfig) {
      return handlePrismaError(
         res,undefined,"Product configuration is missing or invalid",ResponseCodes.BAD_REQUEST
        );
      }

    console.log("productCodeLength", productConfig.product_code_length);

    // Extract the first product_code_length characters from the uniqueCode
    const extractedCode = validation.uniqueCode.substring(0, productConfig.product_code_length);
    console.log("Extracted uniqueCode:", extractedCode);

    // Fetch the product details based on product_id
    const productDetails = await prisma.aggregation_transaction.findFirst({
      where: {
        product_id: validation.productId,
      },
    });
    console.log(productDetails);

    if (!productDetails) {
      return handlePrismaError(
        res,undefined, "Product details not found",ResponseCodes.NOT_FOUND
      );
    }
    console.log("product_gen_id", productDetails.product_gen_id);

    // Validate the generation_id with the extracted code
    if (productDetails.product_gen_id != extractedCode) {
      console.log("Mismatch Product not found for extracted code");
      return handlePrismaError(
        res,undefined, "Product not found or generation ID mismatch", ResponseCodes.NOT_FOUND
      );
    }
    else {
      console.log("Product generation Id match ");
    }
    console.log("......................");


    // 2. 
    const tableName = `${productDetails.product_gen_id.toLowerCase()}${validation.packgelevel}_codes`
    console.log("Table name is ", tableName);
    const uniqueCodeRecord = await prisma.$queryRawUnsafe(`SELECT unique_code FROM ${tableName} WHERE unique_code =$1`,validation.uniqueCode);

    console.log("Fetched unique code record:", uniqueCodeRecord);

    if (!uniqueCodeRecord) {
      return handlePrismaError(
        res,undefined, "Unique code not found",ResponseCodes.NOT_FOUND
      );
    }

    const checkPackageLevel = validation.uniqueCode.substring(productConfig.product_code_length, productConfig.product_code_length+1);
    console.log("check Package Level", checkPackageLevel);

    //Validate package level
    if (checkPackageLevel != validation.packgelevel) {
      console.log("Invalid package level");
      return handlePrismaError(
        res,undefined, "Invalid package level",ResponseCodes.BAD_REQUEST
      );
    }
    console.log("valid Package level");

    // 3.
    const batchCheck = await prisma.$queryRawUnsafe(`SELECT batch_id FROM ${tableName} WHERE unique_code = $1`, validation.uniqueCode);
    console.log(batchCheck);

    console.log("batch id from dynamic table  ", batchCheck[0].batch_id);

    if (batchCheck[0].batch_id != validation.batchId) {
      return handlePrismaError(
        res,undefined,"batch_id is invalid", ResponseCodes.BAD_REQUEST
      );
    }
    console.log("batch_id valid");

    
    // 4.
    const getTable = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE unique_code = $1`, validation.uniqueCode)
    // console.log("get table ",getTable);
    console.log(getTable[0]);
    console.log("get is Scanned", getTable[0].is_scanned);

    if (getTable[0].is_scanned) {
      console.log("inValid allReady scanned");
      return handlePrismaError(
        res,undefined, "Invalid: already scanned",ResponseCodes.CONFLICT 
      );
    }
    else {
      const Scanned = await prisma.$queryRawUnsafe(`UPDATE ${tableName} SET is_scanned = TRUE WHERE unique_code = $1`, validation.uniqueCode)
      console.log(Scanned);
      console.log("code scanned done", Scanned);
    }

  // because validation 
    let validationQuantity = validation.quantity;
    let validatePackaged = validation.packagedl
    
    validationQuantity--;
    if (validationQuantity == 0) {
      validatePackaged--
    }
    return handlePrismaSuccess( res,
      "Package generate_id, package level, batch_id valid",
      { validationQuantity, validatePackaged, currentLevel: validation.packgelevel }
    );

}catch (error) {
  // console.log("aa");  
  if(error.isJoi === true){
    return handlePrismaError(
      res, undefined,error.details[0].message,ResponseCodes.INTERNAL_SERVER_ERROR
    )
 }
    console.error("Error in scan:", error.message);
    return handlePrismaError(
      res, undefined, error.details[0].message,ResponseCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default scanValidation;