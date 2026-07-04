-- CreateTable
CREATE TABLE `konversi_sks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `lamaranId` INTEGER NOT NULL,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `sks` INTEGER NOT NULL,
    `kategori` VARCHAR(191) NOT NULL,
    `prodi` VARCHAR(191) NULL,
    `cpmk` TEXT NULL,
    `objektif` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'menunggu',
    `keterangan` VARCHAR(191) NOT NULL DEFAULT 'Sedang menunggu review koordinator',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `konversi_sks` ADD CONSTRAINT `konversi_sks_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `konversi_sks` ADD CONSTRAINT `konversi_sks_lamaranId_fkey` FOREIGN KEY (`lamaranId`) REFERENCES `lamaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
