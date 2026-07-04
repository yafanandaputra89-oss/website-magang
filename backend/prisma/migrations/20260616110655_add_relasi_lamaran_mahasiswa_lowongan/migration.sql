/*
  Warnings:

  - You are about to drop the column `userId` on the `lamaran` table. All the data in the column will be lost.
  - Added the required column `mahasiswaId` to the `lamaran` table without a default value. This is not possible if the table is not empty.
  - Made the column `lowonganId` on table `lamaran` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `lamaran` DROP COLUMN `userId`,
    ADD COLUMN `mahasiswaId` INTEGER NOT NULL,
    MODIFY `lowonganId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `lamaran` ADD CONSTRAINT `lamaran_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lamaran` ADD CONSTRAINT `lamaran_lowonganId_fkey` FOREIGN KEY (`lowonganId`) REFERENCES `lowongan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
