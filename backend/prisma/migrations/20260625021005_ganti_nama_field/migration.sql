/*
  Warnings:

  - You are about to drop the column `firstName` on the `mahasiswa` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `mahasiswa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `mahasiswa` DROP COLUMN `firstName`,
    DROP COLUMN `lastName`,
    ADD COLUMN `nama` VARCHAR(191) NULL;
