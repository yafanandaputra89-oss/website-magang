const express = require("express");
const router = express.Router();

const mahasiswaController = require("../controllers/mahasiswaController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/profile",
    verifyToken,
    checkRole("mahasiswa"),
    mahasiswaController.getProfileMahasiswa
);

router.put(
    "/profile",
    verifyToken,
    checkRole("mahasiswa"),
    mahasiswaController.createOrUpdateProfileMahasiswa
);

module.exports = router;