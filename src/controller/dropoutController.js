import { ResponseCodes } from "../../constant.js";
import prisma from "../../DB/db.config.js";
const dropoutWholeBatch = async (req, res) => {
  try {
    const { product_id, batch_id } = req.body;
    console.log("product id", product_id);
    console.log("batch id", batch_id);


    // Check product id and batch id 
    if (!product_id || !batch_id) {
      return res.status(ResponseCodes.BAD_REQUEST).json({
        message: "Missing required fields: product_id or batch_id",
      });
    }

    // find product id from batch table 
    const batchDetails = await prisma.batch.findFirst({
      where: {
        product_uuid: product_id,
      },
      select: {
        productHistory: true,
      },
    });

    // check batch id is found or not
    if (!batchDetails || !batchDetails.productHistory) {
      return res.status(ResponseCodes.NOT_FOUND).json({
        message: "Batch details or product history not found",
      });
    }

    // destructure product id and packge laval  from batch-> productHistory
    const { product_uuid, packagingHierarchy } = batchDetails.productHistory;
    console.log("Product UUID:", product_uuid);
    console.log("Packaging Hierarchy:", packagingHierarchy);


    // find product generation id
    const productGenerationDetails = await prisma.productGenerationId.findFirst(
      {
        where: {
          product_id: product_uuid,
        },
        select: {
          generation_id: true,
        },
      }
    );

    // check product generation id find or not
    if (!productGenerationDetails) {
      return res.status(ResponseCodes.NOT_FOUND).json({ message: "Product generation details not found",});
    }
    console.log("prodcut generation id ",productGenerationDetails);

    // Looped hierarchy mapping
    const hierarchyMap = {
      1: [0, 5],
      2: [0, 1, 5],
      3: [0, 1, 2, 5],
      4: [0, 1, 2, 3, 5],
    };

    const loopedValues = hierarchyMap[packagingHierarchy] || [];

    console.log(`Looped values for Packaging Hierarchy ${packagingHierarchy}:`,loopedValues);
    let tableName = productGenerationDetails.generation_id.toLowerCase()
    
    const codes = [];
    for (let i = 0; i < loopedValues.length; i++) {
      const value = loopedValues[i];
      codes.push(`${tableName}${value}_codes`);
      await prisma.$executeRawUnsafe(`UPDATE ${`${tableName}${value}_codes`} SET is_dropped = false`)
    }
    console.log("Generated Codes:", codes);

    return res.status(ResponseCodes.OK).json({message: "successfully",});
  } 
  catch (error) {
    console.error("Error in dropoutWholeBatch:", error);
    return res.status(ResponseCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const dropoutCodes = async(req,res) => {
  try {
    const { product_id, batch_id } = req.body;
    console.log("product id", product_id);
    console.log("batch id", batch_id);

    if (!product_id || !batch_id) {
      return res.status(ResponseCodes.BAD_REQUEST).json({
        message: "Missing required fields: product_id or batch_id",
      });
    }

    const batchDetails = await prisma.batch.findFirst({
      where: {
        product_uuid: product_id,
      },
      select: {
        productHistory: true,
      },
    });

    if (!batchDetails || !batchDetails.productHistory) {
      return res.status(ResponseCodes.NOT_FOUND).json({
        message: "Batch details or product history not found",
      });
    }

    const { product_uuid, packagingHierarchy } = batchDetails.productHistory;

    console.log("Product UUID:", product_uuid);
    console.log("Packaging Hierarchy:", packagingHierarchy);


    // Fetch product generation ID
    const productGenerationDetails = await prisma.productGenerationId.findFirst(
      {
        where: {
          product_id: product_uuid,
        },
        select: {
          generation_id: true,
        },
      }
    );

    if (!productGenerationDetails) {
      return res.status(ResponseCodes.NOT_FOUND).json({
        message: "Product generation details not found",
      });
    }
console.log(productGenerationDetails);

    // Looped hierarchy mapping
    const hierarchyMap = {
      1: [0, 5],
      2: [0, 1, 5],
      3: [0, 1, 2, 5],
      4: [0, 1, 2, 3, 5],
    };

    const loopedValues = hierarchyMap[packagingHierarchy] || [];

    console.log(`Looped values for Packaging Hierarchy ${packagingHierarchy}:`,loopedValues);
    let tableName = productGenerationDetails.generation_id.toLowerCase()
    
    const codes = [];
    for (let i = 0; i < loopedValues.length; i++) {
      const value = loopedValues[i];
      codes.push(`${tableName}${value}_codes`);
    }
    console.log("Generated Codes:", codes);

  const data = [
      "IWT02D68M7", "IWT0IHGYH7", "IWT0W2Z4FK", "IWT055M1SU", "IWT0JMXCZM", "IWT0LB1IXQ",
      "IWT1Q897Q7", "IWT1938JAB", "IWT1VZ82WS", "IWT1CIGMYN", "IWT13HTOCA", "IWT1A3I9EX",
      "IWT18Q2XV6", "IWT128SEYD", "IWT2XYY2LR", "IWT2R05VLR", "IWT2PSIJCZ", "IWT2RVXRYS",
      "IWT558R5HP"
  ]
  
  const superConfig = await prisma.superadmin_configuration.findMany({
    select: {
      code_length: true,
      product_code_length: true,
    }
  })
  const result = data.reduce((acc, item) => {
      const n = item.slice(superConfig[0].product_code_length, superConfig[0].product_code_length+1);
      
      if (!acc[tableName+n]) {
          acc[tableName+n] = [];
      }
      acc[tableName+n].push(item);
      return acc;
  }, {});
  
  // console.log(result);
  Object.entries(result).forEach(async ([tablePrefix, codes])=> {
    console.log("table index ", tablePrefix)
    console.log("codes ", codes)
      await prisma.$executeRawUnsafe(`UPDATE "${tablePrefix}_codes" SET is_dropped = true WHERE unique_code IN ();`)
  })

    return res.status(ResponseCodes.OK).json({
      message: "successfully",
    });
  } catch (error) {
    console.error("Error in dropoutWholeBatch:", error);
    return res.status(ResponseCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export { dropoutWholeBatch, dropoutCodes };
