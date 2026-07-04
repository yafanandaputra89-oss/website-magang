const express = require("express");
const router = express.Router();

const dosenController = require("../controllers/dosenController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

// Admin melihat semua dosen
router.get(
    "/",
    verifyToken,
    checkRole("admin", "mahasiswa"),
    dosenController.getAllDosen
);

// Dosen melihat profil sendiri
router.get(
    "/profile",
    verifyToken,
    checkRole("dosen"),
    dosenController.getProfileDosen
);

// Dosen membuat atau mengubah profil
router.put(
    "/profile",
    verifyToken,
    checkRole("dosen"),
    dosenController.createOrUpdateProfileDosen
);

// Dosen melihat mahasiswa bimbingan
router.get(
    "/bimbingan",
    verifyToken,
    checkRole("dosen"),
    dosenController.getMahasiswaBimbingan
);

module.exports = router;