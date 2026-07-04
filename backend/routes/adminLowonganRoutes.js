const express = require("express");
const router = express.Router();

const adminLowonganController = require("../controllers/adminLowonganController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Semua route di sini wajib login & role admin
router.use(verifyToken, checkRole("admin"));

// ── Daftar & detail ──────────────────────────────────────────────────────────
// GET  /admin/lowongan?search=&status=&tab=&page=&limit=
router.get("/", adminLowonganController.getAllLowongan);

// GET  /admin/lowongan/:id
router.get("/:id", adminLowonganController.getLowonganById);

// ── Kurasi ───────────────────────────────────────────────────────────────────
// PATCH /admin/lowongan/:id/setujui   — Pending → Aktif
router.patch("/:id/setujui", adminLowonganController.setujuiLowongan);

// PATCH /admin/lowongan/:id/tolak     — Pending → Ditolak  (body: { alasan })
router.patch("/:id/tolak", adminLowonganController.tolakLowongan);

// ── Moderasi ─────────────────────────────────────────────────────────────────
// PATCH /admin/lowongan/:id/tandai-bermasalah  (body: { alasan })
router.patch("/:id/tandai-bermasalah", adminLowonganController.tandaiBermasalah);

// DELETE /admin/lowongan/:id          — hapus permanen  (body: { alasan })
router.delete("/:id", adminLowonganController.hapusLowongan);

module.exports = router;