import prisma from "../../DB/db.config.js";
import {codeValid,codeScanValid} from "../validation/codeScanValidation.js";
import { ResponseCodes } from "../../constant.js";
import { handlePrismaError,handlePrismaSuccess } from "../services/prismaResponseHandler.js";
const scanValidation = async (req, res) => {
  try {
  const validation = await codeValid.validateAsync(req.body);
  console.log(validation);
    console.log("AAA");
    
    console.log("uniqueCode:", validation.uniqueCode);
    console.log("productId:", validation.productId);
    console.log("BatchId", validation.batchId);

    //1.
    // Fetch the productCodeLength from superadmin configuration table
    const productConfig = await prisma.superadmin_configuration.findFirst();

    if (!productConfig) {
      return handlePrismaError(
         res,undefined,"Code Length not configured",ResponseCodes.BAD_REQUEST
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
        res,undefined, "Invalid Product Code",ResponseCodes.NOT_FOUND
      );
    }
    console.log("product_gen_id", productDetails.product_gen_id);

    // Validate the generation_id with the extracted code
    if (productDetails.product_gen_id != extractedCode) {
      console.log("Code Scanned from Different Product");
      return handlePrismaError(
        res,undefined, "Code Scanned from Different Product or Invalid Code", ResponseCodes.NOT_FOUND
      );
    }
    else {
      console.log("Product generation Id match ");
    }
    console.log("......................");


    // 2. 
    const tableName = `${productDetails.product_gen_id.toLowerCase()}${validation.packageLevel}_codes`
    console.log("Table name is ", tableName);
    const uniqueCodeRecord = await prisma.$queryRawUnsafe(`SELECT unique_code FROM ${tableName} WHERE unique_code =$1`,validation.uniqueCode);

    console.log("Fetched unique code record:", uniqueCodeRecord);
    console.log(uniqueCodeRecord);
    
    if (uniqueCodeRecord.length<1) {
      return handlePrismaError(
        res,undefined, "Unique code not found",ResponseCodes.NOT_FOUND
      );
    }

    const checkPackageLevel = validation.uniqueCode.substring(productConfig.product_code_length, productConfig.product_code_length+1);
    console.log("check Package Level", checkPackageLevel);

    //Validate package level
    if (checkPackageLevel != validation.packageLevel) {
      console.log("Invalid package level");
      return handlePrismaError(
        res,undefined, "Code Scanned from different packaging level",ResponseCodes.BAD_REQUEST
      );
    }
    console.log("valid Package level");

    // 3.
    const batchCheck = await prisma.$queryRawUnsafe(`SELECT batch_id FROM ${tableName} WHERE unique_code = $1`, validation.uniqueCode);
    console.log(batchCheck);

    console.log("batch id from dynamic table  ", batchCheck[0].batch_id);
    if (batchCheck[0].batch_id != validation.batchId) {
      return handlePrismaError(
        res,undefined,"Scanned Code is from different Batch", ResponseCodes.BAD_REQUEST
      );
    }
    console.log("batch_id valid");

    
    // 4.
    const getTable = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE unique_code = $1`, validation.uniqueCode)
    // console.log("get table ",getTable);
    console.log(getTable[0]);
    console.log("get is Scanned", getTable[0].is_scanned);

    if (getTable[0].is_scanned) {
      console.log("already scanned");
      return handlePrismaError(
        res,undefined, "Code is Already Scanned", ResponseCodes.CONFLICT 
      );
    }
    else {
      const Scanned = await prisma.$queryRawUnsafe(`UPDATE ${tableName} SET is_scanned = TRUE WHERE unique_code = $1`, validation.uniqueCode)
      console.log(Scanned);
      console.log("code scanned done", Scanned);
    }

    validation.quantity--;
    if ( validation.quantity == 0) {
      validation.package--
    }
    return handlePrismaSuccess( res,
      "Successfully scanned",
      { quantity : validation.quantity, package: validation.package, currentLevel: validation.packageLevel }
    );

}catch (error) {
  console.log(error);
  if(error.isJoi === true){
    return handlePrismaError(
      res,undefined, error.details[0].message ,ResponseCodes.INTERNAL_SERVER_ERROR
    )
 }   
    console.error("Error in scan:", error.message);
    return handlePrismaError(
    res,undefined, error.details[0].message ,ResponseCodes.INTERNAL_SERVER_ERROR
    );
  }
};

const codeScan = async (req, res) => {
  try {
    let validation = await codeScanValid.validateAsync(req.body)
    console.log(validation);
    if (validation.currentPackageLevel == 5 && validation.totalProduct == 0) {
      return handlePrismaSuccess( res,
        "All code are scanned",null);
    }
    const productDetails = await prisma.aggregation_transaction.findFirst({
      where: {
        transaction_id: validation.transactionId
      },
    });

    const productInfo = await prisma.product.findFirst({ where: { id: productDetails.product_id } });
    if (!productInfo) {
      return handlePrismaError(
        res,undefined,"Product is not found", ResponseCodes.NOT_FOUND
      );
    }

    const batchInfo = await prisma.batch.findFirst({ where: { id: productDetails.batch_id } })
    if (!batchInfo) {
      return handlePrismaError(
        res,undefined,"Batch is not found", ResponseCodes.NOT_FOUND
      );
    }

    const tableName = `${productDetails.product_gen_id.toLowerCase()}${validation.currentPackageLevel}_codes`
    console.log(tableName)

    const getTable = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE unique_code = $1`, validation.uniqueCode)
    if (!getTable[0]) {
      return handlePrismaError(
        res,undefined,"unique id of this product is not found at this level", ResponseCodes.NOT_FOUND
      );
    }
    console.log(getTable[0]);
    console.log("get is Scanned", getTable[0].is_scanned);

    if (getTable[0].is_scanned) {
      console.log("This code is already scan");
      return handlePrismaError(
        res,undefined,"This code is already scan", ResponseCodes.BAD_REQUEST
      );
    }
    else {
      const Scanned = await prisma.$queryRawUnsafe(`UPDATE ${tableName} SET is_scanned = TRUE WHERE unique_code = $1`, validation.uniqueCode)
      console.log(Scanned);
      console.log("code scanned done", Scanned);
    }

    if (getTable[0].is_aggregated) {
      return handlePrismaError(
        res,undefined,"Invalid all ready aggregated", ResponseCodes.BAD_REQUEST
      );
    }

    else {
      const aggregated = await prisma.$queryRawUnsafe(`UPDATE ${tableName} SET is_aggregated = TRUE WHERE unique_code = $1`, validation.uniqueCode)
      console.log(aggregated);
      console.log("code aggregated done", aggregated);
    }

    if (validation.quantity > 0) {
      validation.quantity--;
    }
    validation.totalProduct--;
    validation.perPackageProduct--;
    if (validation.packageNo == 0 && validation.totalProduct == 1) {
      validation.currentPackageLevel = 5
    }
    else {
      if (validation.quantity == 0) {
        if (validation.perPackageProduct == 0) {
          validation.currentPackageLevel = 0
        }
        else {
          validation.packageNo--;
          validation.currentPackageLevel++;
        }
      }
    }
    return handlePrismaSuccess( res,
      "Successfully scanned",
      { packageNo : validation.packageNo, currentPackageLevel: validation.checkPackageLevel, quantity : validation.quantity, perPackageProduct : validation.perPackageProduct, totalLevel:validation.totalLevel, totalProduct : validation.totalProduct }
    );
  }
  catch (error) {
    
    if(error.isJoi === true){      
      return handlePrismaError(
        res,undefined, error.details[0].message ,ResponseCodes.INTERNAL_SERVER_ERROR
      )
   }  
    console.error("Error in scan:", error.message);
    return handlePrismaError(
          res,undefined, error.meta.message ,ResponseCodes.INTERNAL_SERVER_ERROR
      );
  }
}
export {scanValidation , codeScan};