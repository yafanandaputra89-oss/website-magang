// routes/pengajuanDosenRoutes.js
const express = require("express");
const router = express.Router();
const pengajuanDosenController = require("../controllers/pengajuanDosenController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// MAHASISWA
router.post("/", verifyToken, checkRole("mahasiswa"), pengajuanDosenController.buatPengajuan);
router.get("/saya", verifyToken, checkRole("mahasiswa"), pengajuanDosenController.getPengajuanSaya);

// DOSEN
router.get("/dosen/permohonan", verifyToken, checkRole("dosen"), pengajuanDosenController.getPermohonanDosen);
router.patch("/:id/setujui", verifyToken, checkRole("dosen"), pengajuanDosenController.setujuiPermohonan);
router.patch("/:id/tolak", verifyToken, checkRole("dosen"), pengajuanDosenController.tolakPermohonan);

// ADMIN PRODI
router.get("/", verifyToken, checkRole("admin"), pengajuanDosenController.getAllPengajuan);
router.patch("/:id/tetapkan", verifyToken, checkRole("admin"), pengajuanDosenController.tetapkanDosen);
router.patch("/:id/sahkan", verifyToken, checkRole("admin"), pengajuanDosenController.sahkanBimbingan); // NEW: pengesahan setelah dosen setuju usulan mahasiswa

module.exports = router;