const express = require("express");
const router = express.Router();

const {
    getPengajuanKonversiAdmin,
    updateStatusKonversiAdmin,
} = require("../controllers/persetujuanKonversiAdminController");

const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/",
    verifyToken,
    checkRole("admin"),
    getPengajuanKonversiAdmin
);

router.patch(
    "/:id/status",
    verifyToken,
    checkRole("admin"),
    updateStatusKonversiAdmin
);

module.exports = router;