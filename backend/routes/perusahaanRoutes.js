const express = require("express");
const router = express.Router();

const perusahaanController = require("../controllers/perusahaanController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/dashboard",
    verifyToken,
    checkRole("perusahaan"),
    perusahaanController.getDashboardPerusahaan
);

module.exports = router;