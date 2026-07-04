const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");
const prisma = new PrismaClient();

// GET /api/notifikasi — ambil notifikasi milik user yang login
router.get("/", authMiddleware, async(req, res) => {
    const notif = await prisma.notifikasi.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
    res.json({ data: notif });
});

// PATCH /api/notifikasi/:id/baca
router.patch("/:id/baca", authMiddleware, async(req, res) => {
    await prisma.notifikasi.update({
        where: { id: Number(req.params.id) },
        data: { dibaca: true },
    });
    res.json({ message: "Notifikasi ditandai dibaca" });
});

module.exports = router;