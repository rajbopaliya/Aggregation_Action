/*
  Warnings:

  - A unique constraint covering the columns `[product_id,batch_id,packaging_level]` on the table `Aggregation_transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Aggregation_transaction_product_id_batch_id_packaging_level_key" ON "Aggregation_transaction"("product_id", "batch_id", "packaging_level");
