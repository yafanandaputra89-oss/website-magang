/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastLogin` DATETIME(3) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'Aktif',
    ADD COLUMN `username` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);
