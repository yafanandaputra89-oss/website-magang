const express = require("express");
const router = express.Router();

const {
    getPerusahaanVerifikasi,
    updateStatusVerifikasi,
} = require("../controllers/verifikasiPerusahaanController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get("/", verifyToken, checkRole("admin"), getPerusahaanVerifikasi);

router.patch(
    "/:id/status",
    verifyToken,
    checkRole("admin"),
    updateStatusVerifikasi
);

module.exports = router;