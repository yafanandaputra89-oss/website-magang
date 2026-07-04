-- CreateTable
CREATE TABLE `mahasiswa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `nim` VARCHAR(191) NULL,
    `prodi` VARCHAR(191) NULL,
    `angkatan` VARCHAR(191) NULL,
    `semester` INTEGER NULL,
    `ipk` DOUBLE NULL,
    `totalSks` INTEGER NULL,
    `alamat` VARCHAR(191) NULL,
    `telepon` VARCHAR(191) NULL,
    `fotoProfil` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mahasiswa_userId_key`(`userId`),
    UNIQUE INDEX `mahasiswa_nim_key`(`nim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mahasiswa` ADD CONSTRAINT `mahasiswa_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
