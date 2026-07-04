const express = require("express");
const router = express.Router();

const auditLogController = require("../controllers/auditLogController");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

router.get(
    "/",
    verifyToken,
    checkRole("admin"),
    auditLogController.getAuditLogs
);

module.exports = router;