const express = require("express");
const router = express.Router();
const konversiSksController = require("../controllers/konversiSksController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get("/", verifyToken, checkRole("mahasiswa"), konversiSksController.getKonversiSks);
router.post("/", verifyToken, checkRole("mahasiswa"), konversiSksController.createKonversiSks);
router.get("/:id", verifyToken, checkRole("mahasiswa"), konversiSksController.getDetailKonversiSks);
router.delete("/:id", verifyToken, checkRole("mahasiswa"), konversiSksController.deleteKonversiSks);

module.exports = router;