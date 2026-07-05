// routes/pengajuanDosenRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/pengajuanDosenController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// MAHASISWA
router.post("/", verifyToken, checkRole("mahasiswa"), ctrl.buatPengajuan);
router.get("/saya", verifyToken, checkRole("mahasiswa"), ctrl.getPengajuanSaya);

// DOSEN
router.get("/dosen/permohonan", verifyToken, checkRole("dosen"), ctrl.getPermohonanDosen);
router.patch("/:id/setujui", verifyToken, checkRole("dosen"), ctrl.setujuiPermohonan);
router.patch("/:id/tolak", verifyToken, checkRole("dosen"), ctrl.tolakPermohonan);

// ADMIN PRODI
router.get("/", verifyToken, checkRole("admin"), ctrl.getAllPengajuan);
router.patch("/:id/tetapkan", verifyToken, checkRole("admin"), ctrl.tetapkanDosen);
router.patch("/:id/sahkan", verifyToken, checkRole("admin"), ctrl.sahkanBimbingan); // NEW: pengesahan setelah dosen setuju usulan mahasiswa

module.exports = router;