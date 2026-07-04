-- CreateTable
CREATE TABLE `dosen` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `nip` VARCHAR(191) NULL,
    `nidn` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `rank` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `faculty` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `office` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `avatar` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dosen_userId_key`(`userId`),
    UNIQUE INDEX `dosen_nip_key`(`nip`),
    UNIQUE INDEX `dosen_nidn_key`(`nidn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dosen_education` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dosenId` INTEGER NOT NULL,
    `degree` VARCHAR(191) NOT NULL,
    `school` VARCHAR(191) NOT NULL,
    `year` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dosen_course` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dosenId` INTEGER NOT NULL,
    `course` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `semester` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dosen_expertise` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dosenId` INTEGER NOT NULL,
    `tag` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dosen_certification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dosenId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `issuer` VARCHAR(191) NOT NULL,
    `year` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dosen` ADD CONSTRAINT `dosen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dosen_education` ADD CONSTRAINT `dosen_education_dosenId_fkey` FOREIGN KEY (`dosenId`) REFERENCES `dosen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dosen_course` ADD CONSTRAINT `dosen_course_dosenId_fkey` FOREIGN KEY (`dosenId`) REFERENCES `dosen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dosen_expertise` ADD CONSTRAINT `dosen_expertise_dosenId_fkey` FOREIGN KEY (`dosenId`) REFERENCES `dosen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dosen_certification` ADD CONSTRAINT `dosen_certification_dosenId_fkey` FOREIGN KEY (`dosenId`) REFERENCES `dosen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
