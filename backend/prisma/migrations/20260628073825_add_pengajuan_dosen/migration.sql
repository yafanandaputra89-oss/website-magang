-- CreateTable
CREATE TABLE `pengajuan_dosen_pembimbing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lamaranId` INTEGER NOT NULL,
    `mahasiswaId` INTEGER NOT NULL,
    `dosenUsulanId` INTEGER NULL,
    `dosenDitetapkanId` INTEGER NULL,
    `alasanMemilih` TEXT NOT NULL,
    `catatanTambahan` TEXT NULL,
    `status` ENUM('MENUNGGU_VERIFIKASI_PRODI', 'MENUNGGU_PERSETUJUAN_DOSEN', 'BIMBINGAN_AKTIF', 'DITOLAK_DOSEN', 'SELESAI') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI_PRODI',
    `alasanPenolakan` TEXT NULL,
    `catatanProdi` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pengajuan_dosen_pembimbing_lamaranId_key`(`lamaranId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `riwayat_status_pengajuan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengajuanId` INTEGER NOT NULL,
    `status` ENUM('MENUNGGU_VERIFIKASI_PRODI', 'MENUNGGU_PERSETUJUAN_DOSEN', 'BIMBINGAN_AKTIF', 'DITOLAK_DOSEN', 'SELESAI') NOT NULL,
    `keterangan` TEXT NULL,
    `changedById` INTEGER NULL,
    `changedByRole` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pengajuan_dosen_pembimbing` ADD CONSTRAINT `pengajuan_dosen_pembimbing_lamaranId_fkey` FOREIGN KEY (`lamaranId`) REFERENCES `lamaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengajuan_dosen_pembimbing` ADD CONSTRAINT `pengajuan_dosen_pembimbing_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengajuan_dosen_pembimbing` ADD CONSTRAINT `pengajuan_dosen_pembimbing_dosenUsulanId_fkey` FOREIGN KEY (`dosenUsulanId`) REFERENCES `dosen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengajuan_dosen_pembimbing` ADD CONSTRAINT `pengajuan_dosen_pembimbing_dosenDitetapkanId_fkey` FOREIGN KEY (`dosenDitetapkanId`) REFERENCES `dosen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `riwayat_status_pengajuan` ADD CONSTRAINT `riwayat_status_pengajuan_pengajuanId_fkey` FOREIGN KEY (`pengajuanId`) REFERENCES `pengajuan_dosen_pembimbing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
