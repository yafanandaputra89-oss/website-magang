-- AlterTable
ALTER TABLE `perusahaan` ADD COLUMN `deskripsi` TEXT NULL,
    ADD COLUMN `deskripsiSingkat` TEXT NULL,
    ADD COLUMN `galeri` TEXT NULL,
    ADD COLUMN `instagram` VARCHAR(191) NULL,
    ADD COLUMN `kultur` TEXT NULL,
    ADD COLUMN `linkedin` VARCHAR(191) NULL,
    ADD COLUMN `logo` VARCHAR(191) NULL,
    ADD COLUMN `lokasi` VARCHAR(191) NULL,
    ADD COLUMN `nilaiKultur` TEXT NULL,
    ADD COLUMN `tahunBerdiri` VARCHAR(191) NULL,
    ADD COLUMN `ukuran` VARCHAR(191) NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;
