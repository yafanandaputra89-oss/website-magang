const express = require("express");
const router = express.Router();
const magangController = require("../controllers/magangController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

/* ── Route yang SUDAH ADA (sisi perusahaan) — tidak berubah ─────────────── */
router.get("/", verifyToken, checkRole("perusahaan"), magangController.getMahasiswaMagang);
router.get("/:id", verifyToken, checkRole("perusahaan"), magangController.getMahasiswaMagangDetail);
router.patch("/:id/status", verifyToken, checkRole("perusahaan"), magangController.updateStatusMagang);
router.post("/:id/penilaian", verifyToken, checkRole("perusahaan"), magangController.createPenilaian);



module.exports = router;