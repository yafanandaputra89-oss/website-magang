const express = require("express");
const router = express.Router();

const rekrutmenController = require("../controllers/rekrutmenController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/pelamar",
    verifyToken,
    checkRole("perusahaan", "admin"),
    rekrutmenController.getPelamarPerusahaan
);

router.patch(
    "/pelamar/:id/status",
    verifyToken,
    checkRole("perusahaan", "admin"),
    rekrutmenController.updateStatusPelamar
);

router.patch(
    "/pelamar/:id/interview",
    verifyToken,
    checkRole("perusahaan", "admin"),
    rekrutmenController.jadwalkanInterview
);

module.exports = router;