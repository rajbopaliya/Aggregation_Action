import Joi from "@hapi/joi"

const codeValid = Joi.object({
    uniqueCode: Joi.string().required(),
    productId : Joi.string().required(),
    batchId : Joi.string().required(),
    packgelevel: Joi.number().integer().required(),
    packaged: Joi.number().integer().required(),
    quantity: Joi.number().integer().required(),
})

export default codeValid