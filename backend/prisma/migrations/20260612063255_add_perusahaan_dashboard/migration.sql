-- CreateTable
CREATE TABLE `perusahaan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `nama` VARCHAR(191) NULL,
    `bidang` VARCHAR(191) NULL,
    `alamat` VARCHAR(191) NULL,
    `telepon` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `perusahaan_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lowongan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `perusahaanId` INTEGER NOT NULL,
    `posisi` VARCHAR(191) NOT NULL,
    `departemen` VARCHAR(191) NULL,
    `kuota` INTEGER NOT NULL,
    `deadline` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Aktif',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pelamar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lowonganId` INTEGER NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `posisi` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Menunggu Review',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_kebutuhan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `percentage` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `perusahaan` ADD CONSTRAINT `perusahaan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lowongan` ADD CONSTRAINT `lowongan_perusahaanId_fkey` FOREIGN KEY (`perusahaanId`) REFERENCES `perusahaan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pelamar` ADD CONSTRAINT `pelamar_lowonganId_fkey` FOREIGN KEY (`lowonganId`) REFERENCES `lowongan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
