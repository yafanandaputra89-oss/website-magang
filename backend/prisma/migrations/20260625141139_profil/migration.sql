-- AlterTable
ALTER TABLE `perusahaan` ADD COLUMN `deskripsi` TEXT NULL,
    ADD COLUMN `deskripsiSingkat` VARCHAR(255) NULL,
    ADD COLUMN `instagram` VARCHAR(191) NULL,
    ADD COLUMN `kultur` TEXT NULL,
    ADD COLUMN `linkedin` VARCHAR(191) NULL,
    ADD COLUMN `logo` VARCHAR(10) NULL,
    ADD COLUMN `nilaiKultur` TEXT NULL,
    ADD COLUMN `tahunBerdiri` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `galeri_perusahaan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `perusahaanId` INTEGER NOT NULL,
    `image` TEXT NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `galeri_perusahaan` ADD CONSTRAINT `galeri_perusahaan_perusahaanId_fkey` FOREIGN KEY (`perusahaanId`) REFERENCES `perusahaan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
