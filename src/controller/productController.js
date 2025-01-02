import { handlePrismaSuccess,handlePrismaError } from "../services/prismaResponseHandler.js";
import prisma from "../../DB/db.config.js";

const getAllProducts = async (req, res) => {
  console.log("product api called.......");
  
    const { limit = 25, page = 1, search = '', esign_status = '', product_name = '' } = req.query;
    const offset = (page - 1) * parseInt(limit, 10);    
    try {
      const where = {
        ...(search && {
          OR: [
            { product_name: { contains: search, mode: "insensitive" } },
            { product_id: { contains: search, mode: "insensitive" } },
            { gtin: { contains: search, mode: "insensitive" } },
            { ndc: { contains: search, mode: "insensitive" } },
            { generic_name: { contains: search, mode: "insensitive" } },
  
            { packaging_size: { contains: search, mode: "insensitive" } },
            { antidote_statement: { contains: search, mode: "insensitive" } },
            { registration_no: { contains: search, mode: "insensitive" } },
  
          ],
        }),
        ...(esign_status && { esign_status: esign_status.toLowerCase() }),
        ...(product_name && { product_name: { contains: product_name, mode: "insensitive" } }),
      };
  
      const [products, total] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          skip: offset,
          take: parseInt(limit, 10) !== -1 ? parseInt(limit, 10) : undefined,
          include: {
            company: {
              select: {
                id: true,
                company_name: true,
              },
            },
            countryMaster: true
          },
        }),
        prisma.product.count({ where }),
      ]);
      const newProducts = products.map((el) => ({ ...el, product_image: `${process.env.URL}${el.product_image}`, label: `${process.env.URL}${el.label}`, leaflet: `${process.env.URL}${el.leaflet}` }));
      handlePrismaSuccess(res, "Get all products successfully", { products: newProducts, total });
    } catch (error) {
      console.error("Error while fetching products:", error);
      handlePrismaError(res, error, "An error occurred while fetching products.", ResponseCodes.INTERNAL_SERVER_ERROR);
    }
  };

  export default getAllProducts