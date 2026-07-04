const express = require("express");
const router = express.Router();

const lowonganController = require("../controllers/lowonganController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const { checkVerifikasiPerusahaan } = require("../middleware/checkVerifikasiPerusahaan");

// ── Routes untuk perusahaan (perlu login & role perusahaan) ──
router.get("/", verifyToken, checkRole("perusahaan"), lowonganController.getLowongan);

// POST & PUT wajib perusahaan sudah terverifikasi (DITERIMA) oleh admin
router.post(
    "/",
    verifyToken,
    checkRole("perusahaan"),
    checkVerifikasiPerusahaan,
    lowonganController.createLowongan
);

router.put(
    "/:id",
    verifyToken,
    checkRole("perusahaan"),
    checkVerifikasiPerusahaan,
    lowonganController.updateLowongan
);

// Hapus lowongan tidak perlu cek verifikasi (boleh tetap dihapus meski status berubah)
router.delete("/:id", verifyToken, checkRole("perusahaan"), lowonganController.deleteLowongan);

// ── Routes publik (tidak perlu login) ──
router.get("/public", lowonganController.getPublicLowongan);
router.get("/public/:slug", lowonganController.getPublicLowonganBySlug); // ✅ ganti dari :id ke :slug

module.exports = router;