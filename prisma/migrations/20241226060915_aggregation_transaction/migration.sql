-- CreateTable
CREATE TABLE "Aggregation_transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "aggregation_count" INTEGER NOT NULL DEFAULT 0,
    "product_gen_id" TEXT NOT NULL,
    "packaging_level" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Aggregation_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scanned_code" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "scanned_0_codes" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "scanned_1_codes" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "scanned_2_codes" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "scanned_3_codes" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "scanned_5_codes" JSONB[] DEFAULT ARRAY[]::JSONB[],

    CONSTRAINT "Scanned_code_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Aggregation_transaction" ADD CONSTRAINT "Aggregation_transaction_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aggregation_transaction" ADD CONSTRAINT "Aggregation_transaction_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aggregation_transaction" ADD CONSTRAINT "Aggregation_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scanned_code" ADD CONSTRAINT "Scanned_code_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Aggregation_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
