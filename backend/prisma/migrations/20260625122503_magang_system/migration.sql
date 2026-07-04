/*
  Warnings:

  - You are about to drop the column `nama` on the `mahasiswa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `mahasiswa` DROP COLUMN `nama`,
    ADD COLUMN `name` VARCHAR(191) NULL;
