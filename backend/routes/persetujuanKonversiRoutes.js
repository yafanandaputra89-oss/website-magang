const express = require("express");
const router = express.Router();

const {
    getPengajuanKonversiDosen,
    updateStatusKonversiDosen,
} = require("../controllers/persetujuanKonversiController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/",
    verifyToken,
    checkRole("dosen"),
    getPengajuanKonversiDosen
);

router.patch(
    "/:id/status",
    verifyToken,
    checkRole("dosen"),
    updateStatusKonversiDosen
);

module.exports = router;