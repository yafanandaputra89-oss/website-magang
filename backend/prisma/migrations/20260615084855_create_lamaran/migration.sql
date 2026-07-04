-- CreateTable
CREATE TABLE `lamaran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `lowonganId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NOT NULL,
    `major` VARCHAR(191) NULL,
    `semester` VARCHAR(191) NULL,
    `portfolio` VARCHAR(191) NULL,
    `skills` TEXT NULL,
    `motivation` TEXT NOT NULL,
    `cvFile` VARCHAR(191) NOT NULL,
    `coverLetter` VARCHAR(191) NULL,
    `transcript` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
