import { ResponseCodes } from "../../constant.js";
import prisma from "../../DB/db.config.js";

const aggregationtran = async (req, res) => {
  try {
    const { product_id, batch_id } = req.body;
    console.log(req.id);
    
    if (!product_id || !batch_id) {
      return res.status(ResponseCodes.BAD_REQUEST).json({
        message: "Missing required fields: product_id or batch_id",
      });
    }

    // Fetch generation_id for the provided product_id
    const productGeneration = await prisma.productGenerationId.findFirst({
      where: {
        product_id: product_id,
      },
      select: {
        generation_id: true,
      },
    });

    if (!productGeneration || !productGeneration.generation_id) {
      return res
        .status(ResponseCodes.NOT_FOUND)
        .json({ error: "Generation ID not found for the provided product_id" });
    }
    console.log("Retrieved generation_id:", productGeneration.generation_id);

    // Fetch packaging hierarchy for the product
    const productHistory = await prisma.product_history.findFirst({
      where: {
        product_uuid: product_id,
      },
      select: {
        packagingHierarchy: true,
      },
    });
    console.log( "packaging Hierarchy from productHistory" ,productHistory.packagingHierarchy);

    // Fetch product history ID for the batch
    const batchDetails = await prisma.batch.findFirst({
      where: {
        product_uuid: product_id,
      },
      select: {
        producthistory_uuid: true,
      },
    });
    console.log("product history uuid from batch",batchDetails.producthistory_uuid);

    // Check for existing aggregation transaction
    const existingAggregation = await prisma.aggregation_transaction.findFirst({
      where: {
        user_id:req.id
      },
    });

    if (existingAggregation) {
      console.log("Aggregation transaction already exists in this user"); 
      res.status(ResponseCodes.CONFLICT).json({ message: "Aggregation transaction already exists in this user" });
      return;
    }

    // Create a new aggregation transaction
    const updateAggregation = await prisma.aggregation_transaction.create({
      data: {
        product_id: product_id,
        batch_id: batch_id,
        user_id: req.id,
        product_gen_id: productGeneration.generation_id,
        packagingHierarchy: productHistory.packagingHierarchy,
        producthistory_uuid: batchDetails.producthistory_uuid,
      },
    });

    console.log("Aggregation transaction created:", updateAggregation);
    return res.status(ResponseCodes.OK).json({
        message: "Aggregation transaction created successfully",
        data: updateAggregation,
      });
  } catch (error) {
    console.log("Error in aggregationtran:", error);
    return res
      .status(ResponseCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Internal Server Error", error: error });
  }
};

export default aggregationtran;
