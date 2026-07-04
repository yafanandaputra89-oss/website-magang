-- CreateTable
CREATE TABLE `laporan_magang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lamaranId` INTEGER NOT NULL,
    `mahasiswaId` INTEGER NOT NULL,
    `dosenId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `catatan` TEXT NULL,
    `fileUrl` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'MENUNGGU_REVIEW',
    `feedback` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `laporan_magang` ADD CONSTRAINT `laporan_magang_lamaranId_fkey` FOREIGN KEY (`lamaranId`) REFERENCES `lamaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `laporan_magang` ADD CONSTRAINT `laporan_magang_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `laporan_magang` ADD CONSTRAINT `laporan_magang_dosenId_fkey` FOREIGN KEY (`dosenId`) REFERENCES `dosen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
