import { ResponseCodes } from "../../constant.js";
import prisma from "../../DB/db.config.js";

const aggregationtran = async (req, res) => {
  try {
    const { product_id, batch_id } = req.body;
    if (!product_id || !batch_id) {
        return res.status(ResponseCodes.BAD_REQUEST).json({ 
            message : "Missing required fields: product_id or batch_id",
        });
    }
    const update = await prisma.productGenerationId.findFirst({
      where: {
        product_id: product_id,
      },
      select: {
        generation_id: true,
      },
    });
    if (!update || !update.generation_id) {
        return res.status(ResponseCodes.NOT_FOUND).json({ error: "Generation ID not found for the given product_id" });
    }
    console.log("Retrieved generation_id:", update.generation_id);


    const existingAggregation = await prisma.aggregation_transaction.findUnique({
      where:{
        product_id:product_id,
        batch_id:batch_id,
        packaging_level:0
      }
    })

    if(existingAggregation){
      res.status(ResponseCodes.CONFLICT).json({message: "Aggregation transaction already exists"})
    }

    // Create a new aggregation transaction
    const updateAggregation = await prisma.aggregation_transaction.create({
      data: {
        product_id: product_id,
        batch_id: batch_id,
        user_id: req.id,
        product_gen_id: update.generation_id,
        packaging_level: 0,
      },
    });
    console.log("Aggregation transaction created:", updateAggregation);
    return res.status(ResponseCodes.OK).json({ message: "Aggregation transaction created successfully",data: updateAggregation});
    
  } catch (error) {
    console.log("Error in aggregationtran:", error);
    return res.status(ResponseCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error", error:error });
  }
};

export default aggregationtran;
