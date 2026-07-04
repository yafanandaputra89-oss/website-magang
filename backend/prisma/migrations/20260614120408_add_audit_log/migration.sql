-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `userName` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'BERHASIL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
