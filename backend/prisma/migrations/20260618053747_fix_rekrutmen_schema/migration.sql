/*
  Warnings:

  - You are about to alter the column `status` on the `lamaran` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `lamaran` MODIFY `status` ENUM('PENDING_BERKAS', 'BERKAS_DITERIMA', 'BERKAS_DITOLAK', 'INTERVIEW_DIJADWALKAN', 'LOLOS_INTERVIEW', 'TIDAK_LOLOS_INTERVIEW', 'DITERIMA_MAGANG', 'DITOLAK') NOT NULL DEFAULT 'PENDING_BERKAS';

-- CreateTable
CREATE TABLE `jadwal_interview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lamaranId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `jam` VARCHAR(191) NOT NULL,
    `lokasi` VARCHAR(191) NOT NULL,
    `linkMeeting` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `jadwal_interview_lamaranId_key`(`lamaranId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifikasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `lamaranId` INTEGER NULL,
    `judul` VARCHAR(191) NOT NULL,
    `pesan` VARCHAR(191) NOT NULL,
    `dibaca` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `jadwal_interview` ADD CONSTRAINT `jadwal_interview_lamaranId_fkey` FOREIGN KEY (`lamaranId`) REFERENCES `lamaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifikasi` ADD CONSTRAINT `notifikasi_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifikasi` ADD CONSTRAINT `notifikasi_lamaranId_fkey` FOREIGN KEY (`lamaranId`) REFERENCES `lamaran`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
