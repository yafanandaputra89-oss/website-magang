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


router.get(
    "/admin/mahasiswa/count",
    verifyToken,
    checkRole("admin"),
    mahasiswaController.getTotalMahasiswa
);

module.exports = router;