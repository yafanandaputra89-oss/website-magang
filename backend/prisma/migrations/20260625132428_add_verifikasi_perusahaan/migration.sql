/*
  Warnings:

  - You are about to drop the column `deskripsi` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `deskripsiSingkat` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `galeri` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `instagram` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `kultur` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `linkedin` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `lokasi` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `nilaiKultur` on the `perusahaan` table. All the data in the column will be lost.
  - You are about to drop the column `tahunBerdiri` on the `perusahaan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `perusahaan` DROP COLUMN `deskripsi`,
    DROP COLUMN `deskripsiSingkat`,
    DROP COLUMN `galeri`,
    DROP COLUMN `instagram`,
    DROP COLUMN `kultur`,
    DROP COLUMN `linkedin`,
    DROP COLUMN `logo`,
    DROP COLUMN `lokasi`,
    DROP COLUMN `nilaiKultur`,
    DROP COLUMN `tahunBerdiri`,
    ADD COLUMN `catatanVerifikasi` TEXT NULL,
    ADD COLUMN `jabatanCP` VARCHAR(191) NULL,
    ADD COLUMN `namaCP` VARCHAR(191) NULL,
    ADD COLUMN `statusVerifikasi` VARCHAR(191) NOT NULL DEFAULT 'MENUNGGU',
    ADD COLUMN `tanggalVerifikasi` DATETIME(3) NULL;
