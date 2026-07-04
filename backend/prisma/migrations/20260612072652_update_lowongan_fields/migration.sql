-- AlterTable
ALTER TABLE `lowongan` ADD COLUMN `deskripsi` TEXT NULL,
    ADD COLUMN `durasi` VARCHAR(191) NULL,
    ADD COLUMN `experience` VARCHAR(191) NULL,
    ADD COLUMN `gaji` VARCHAR(191) NULL,
    ADD COLUMN `lokasi` VARCHAR(191) NULL,
    ADD COLUMN `niceToHave` TEXT NULL,
    ADD COLUMN `requirements` TEXT NULL,
    ADD COLUMN `responsibilities` TEXT NULL,
    ADD COLUMN `tags` TEXT NULL,
    ADD COLUMN `target` INTEGER NULL,
    ADD COLUMN `tipe` VARCHAR(191) NULL,
    ADD COLUMN `whoYouAre` TEXT NULL;
