import Joi from "@hapi/joi"

const AggregationValidation = Joi.object({
    product_id: Joi.string().required(),
    batch_id:Joi.string().required(),
    esign_status: Joi.string().valid("rejected", "approved", "pending", null)
})

export default AggregationValidation;