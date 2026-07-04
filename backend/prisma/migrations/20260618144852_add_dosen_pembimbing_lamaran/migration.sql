/*
  Warnings:

  - You are about to drop the column `dosenPembimbing` on the `mahasiswa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `lamaran` ADD COLUMN `dosenPembimbingId` INTEGER NULL;

-- AlterTable
ALTER TABLE `mahasiswa` DROP COLUMN `dosenPembimbing`;

-- AddForeignKey
ALTER TABLE `lamaran` ADD CONSTRAINT `lamaran_dosenPembimbingId_fkey` FOREIGN KEY (`dosenPembimbingId`) REFERENCES `dosen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
