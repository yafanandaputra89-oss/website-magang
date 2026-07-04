const express = require("express");
const router = express.Router();

const perusahaanProfileController = require("../controllers/perusahaanProfileController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/profile",
    verifyToken,
    checkRole("perusahaan"),
    perusahaanProfileController.getProfilePerusahaan
);

router.put(
    "/profile",
    verifyToken,
    checkRole("perusahaan"),
    perusahaanProfileController.createOrUpdateProfilePerusahaan
);

module.exports = router;