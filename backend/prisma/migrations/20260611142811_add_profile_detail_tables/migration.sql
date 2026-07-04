-- AlterTable
ALTER TABLE `mahasiswa` ADD COLUMN `about` TEXT NULL,
    ADD COLUMN `dosenPembimbing` VARCHAR(191) NULL,
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `skills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pendidikan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `school` VARCHAR(191) NOT NULL,
    `degree` VARCHAR(191) NOT NULL,
    `startYear` VARCHAR(191) NOT NULL,
    `endYear` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengalaman` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `company` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sosial_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `instagram` VARCHAR(191) NULL,
    `twitter` VARCHAR(191) NULL,
    `github` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,

    UNIQUE INDEX `sosial_media_mahasiswaId_key`(`mahasiswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `skills` ADD CONSTRAINT `skills_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pendidikan` ADD CONSTRAINT `pendidikan_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengalaman` ADD CONSTRAINT `pengalaman_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sosial_media` ADD CONSTRAINT `sosial_media_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `mahasiswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
