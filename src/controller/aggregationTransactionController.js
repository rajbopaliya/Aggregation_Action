import { ResponseCodes } from "../../constant.js";
import prisma from "../../DB/db.config.js";
import { logAudit } from '../utils/auditLog.js'
import AggregationValidation from "../validation/aggregationTransactionValidation.js";
import { handlePrismaSuccess, handlePrismaError } from "../services/prismaResponseHandler.js";

const aggregationtran = async (req, res) => {
  try {
    const validation = await AggregationValidation.validateAsync(req.body);
    console.log(req.id);
    const { auditlog_username, auditlog_userid } = req;
    console.log(auditlog_username);

    if (!validation.product_id || !validation.batch_id) {
      return handlePrismaError(
        res,undefined,"Missing required fields: product_id or batch_id", ResponseCodes.BAD_REQUEST
      );
    }

    // Fetch generation_id for the provided product_id
    const productGeneration = await prisma.productGenerationId.findFirst({
      where: {
        product_id: validation.product_id,
      },
      select: {
        generation_id: true,
      },
    });

    if (!productGeneration || !productGeneration.generation_id) {
      return handlePrismaError(
        res,undefined,"Generation ID not found for the provided product_id",ResponseCodes.NOT_FOUND  
      )
    }

    console.log("Retrieved generation_id:", productGeneration.generation_id);

    // Fetch packaging hierarchy for the product
    const productHistory = await prisma.product_history.findFirst({
      where: {
        product_uuid: validation.product_id,
      },
      select: {
        packagingHierarchy: true,
      },
    });

    if (!productHistory) {
      return handlePrismaError(
        res, undefined,"Packaging hierarchy not found for the provided product_id",ResponseCodes.NOT_FOUND 
      );
    }

    console.log("packaging Hierarchy from productHistory", productHistory.packagingHierarchy);

    // Fetch product history ID for the batch
    const batchDetails = await prisma.batch.findFirst({
      where: {
        product_uuid: validation.product_id,
      },
      select: {
        producthistory_uuid: true,
      },
    });

    if (!batchDetails) {
      return handlePrismaError(
        res, undefined,"Batch details not found for the provided product_id",ResponseCodes.NOT_FOUND,
      );
    }

    console.log("product history uuid from batch", batchDetails.producthistory_uuid);

    // Check for existing aggregation transaction
    const existingAggregation = await prisma.aggregation_transaction.findFirst({
      where: {
        user_id: req.id
      },
    });
    console.log(existingAggregation);
    if (existingAggregation) {
    console.log("Aggregation transaction already exists in this user");
    return handlePrismaError(
      res,undefined,"Aggregation transaction already exists for this user",ResponseCodes.CONFLICT
    )}

    // Create a new aggregation transaction
    const updateAggregation = await prisma.aggregation_transaction.create({
      data: {
        product_id: validation.product_id,
        batch_id: validation.batch_id,
        user_id: req.id,
        product_gen_id: productGeneration.generation_id,
        packagingHierarchy: productHistory.packagingHierarchy,
        producthistory_uuid: batchDetails.producthistory_uuid,
        esign_status:validation.esign_status,
      },
    });

    console.log("Aggregation transaction created:", updateAggregation);
    if (validation.audit_log?.audit_log) {
      await logAudit({
        performed_action: audit_log.performed_action,
        remarks: audit_log.remarks,
        user_name: auditlog_username,
        user_id: auditlog_userid,
      });
    }
    return handlePrismaSuccess(res,"Aggregation transaction created successfully")

  } catch (error) {
    if(error.isJoi === true){
      return handlePrismaError (
        res,undefined, error.details[0].message,ResponseCodes.INTERNAL_SERVER_ERROR
      )}

    console.log("Error in aggregationtran:", error);    
   return handlePrismaError(
    res,undefined, error.meta.message ,ResponseCodes.INTERNAL_SERVER_ERROR
  )}
};

export default aggregationtran;   