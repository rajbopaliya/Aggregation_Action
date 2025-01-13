import { ResponseCodes } from "../../constant.js";
import prisma from "../../DB/db.config.js";
const dropoutWholeBatch = async (req, res) => {
  try {
    const { product_id, batch_id, dropout_reason } = req.body;
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
    // console.log("Product UUID:", product_uuid);
    // console.log("Packaging Hierarchy:", packagingHierarchy);

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
      return res
        .status(ResponseCodes.NOT_FOUND)
        .json({ message: "Product generation details not found" });
    }
    // console.log("prodcut generation id ",productGenerationDetails);

    // Looped hierarchy mapping
    const hierarchyMap = {
      1: [0, 5],
      2: [0, 1, 5],
      3: [0, 1, 2, 5],
      4: [0, 1, 2, 3, 5],
    };

    const loopedValues = hierarchyMap[packagingHierarchy] || [];

    // console.log(`Looped values for Packaging Hierarchy ${packagingHierarchy}:`,loopedValues);
    let tableNamePrefix = productGenerationDetails.generation_id.toLowerCase();

    const codes = [];
    for (let i = 0; i < loopedValues.length; i++) {
      const value = loopedValues[i];
      codes.push(`${tableNamePrefix}${value}_codes`);
      await prisma.$queryRawUnsafe(
        `UPDATE "${tableNamePrefix}${value}_codes" 
         SET is_dropped = false, 
             dropout_reason = $1`,
        dropout_reason
      );
    }
    console.log("Generated Codes:", codes);

    return res.status(ResponseCodes.OK).json({
      message: "Batch dropout successfully",
      success: true,
      code: ResponseCodes.OK,
    });
  } catch (error) {
    console.error("Error in dropoutWholeBatch:", error);
    return res.status(ResponseCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

async function updateCodes(tablePrefix, tableLevel, codes, dropout_reason) {
  console.log(
    `Updating table: ${tablePrefix}${tableLevel}_codes for codes:`,
    codes
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "${tablePrefix}${tableLevel}_codes"
       SET is_dropped = true,
       dropout_reason = ${dropout_reason}
       WHERE unique_code IN (${codes.map((code) => `'${code}'`).join(",")})`
  );
}

async function updateChildTable(
  tablePrefix,
  tableLevel,
  parentIds,
  dropout_reason
) {
  const childTableName = `${tablePrefix}${tableLevel}_codes`;
  console.log(
    `Updating parent table: ${childTableName} for parent ID:`,
    parentIds
  );
  return await prisma.$queryRawUnsafe(
    `UPDATE "${childTableName}"
         SET is_dropped = true, 
         dropout_reason = $1
         WHERE parent_id = ANY($2::uuid[])
         RETURNING id`,
    dropout_reason,
    parentIds
  );
}

async function processResults(result, tableNamePrefix, dropout_reason, packagingHierarchy) {
  const childTableMap = {
    0: null,
    1: [0],
    2: [1],
    3: [2],
    5: {
      1: [0],
      2: [1],
      3: [2],
      4: [3],
    },
  };
  for (const [tableLevel, codes] of Object.entries(result)) {
    let currentTableLevel = parseInt(tableLevel);

    console.log(
      "Processing table level:",
      currentTableLevel,
      "with codes:",
      codes
    );

    if (currentTableLevel === 0) {
      await updateCodes(
        tableNamePrefix,
        currentTableLevel,
        codes,
        dropout_reason
      );
    } else {
      for (const code of codes) {
        const updateResult = await prisma.$queryRawUnsafe(
          `UPDATE "${tableNamePrefix}${currentTableLevel}_codes"
             SET is_dropped = true,
             dropout_reason = $1
             WHERE unique_code = $2
             RETURNING id`,
          dropout_reason,
          code
        );

        if (updateResult.length > 0) {
          let parentIds = [updateResult[0].id];
          console.log("Updated record with ID:", parentIds);

          while (currentTableLevel > 0) {
            console.log("Current level while ", currentTableLevel);
            const updateCurrentLevel =
              currentTableLevel === 5
                ? childTableMap[currentTableLevel][packagingHierarchy]
                : childTableMap[currentTableLevel];
            const nextUpdates = await updateChildTable(
              tableNamePrefix,
              updateCurrentLevel,
              parentIds,
              dropout_reason
            );
            console.log("Child record updated with ID:", nextUpdates);
            parentIds = nextUpdates.map((record) => record.id);
            currentTableLevel === 5
              ? (currentTableLevel = updateCurrentLevel)
              : currentTableLevel--;
          }
        }
      }
    }
  }
}

const dropoutCodes = async (req, res) => {
  try {
    const { product_id, batch_id, dropoutCodes, dropout_reason } = req.body;
    console.log("Dropout req body ", req.body);

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

    // Looped hierarchy mapping
    const hierarchyMap = {
      1: [0, 5],
      2: [0, 1, 5],
      3: [0, 1, 2, 5],
      4: [0, 1, 2, 3, 5],
    };

    const loopedValues = hierarchyMap[packagingHierarchy] || [];

    // console.log(`Looped values for Packaging Hierarchy ${packagingHierarchy}:`,loopedValues);
    let tableNamePrefix = productGenerationDetails.generation_id.toLowerCase();

    // const codes = [];
    // for (let i = 0; i < loopedValues.length; i++) {
    //   const value = loopedValues[i];
    //   codes.push(`${tableNamePrefix}${value}_codes`);
    // }
    // console.log("Generated Codes:", codes);

    const superConfig = await prisma.superadmin_configuration.findMany({
      select: {
        code_length: true,
        product_code_length: true,
      },
    });
    const result = dropoutCodes.reduce((acc, item) => {
      const n = item.slice(
        superConfig[0].product_code_length,
        superConfig[0].product_code_length + 1
      );

      if (!acc[n]) {
        acc[n] = [];
      }
      acc[n].push(item);
      return acc;
    }, {});

    console.log("Grouping codes by level ", result);

    await processResults(result, tableNamePrefix, dropout_reason, packagingHierarchy);

    return res.status(ResponseCodes.OK).json({
      success: true,
      message: "Scanned codes dropped successfully",
      code: ResponseCodes.OK,
    });
  } catch (error) {
    console.error("Error in dropout codes :", error);
    return res.status(ResponseCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export { dropoutWholeBatch, dropoutCodes };
