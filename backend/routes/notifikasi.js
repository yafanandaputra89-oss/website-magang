const express = require("express");
const router = express.Router();

const prisma = require("../config/prisma");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, async(req, res) => {
    try {
        const data = await prisma.notifikasi.findMany({
            where: {
                userId: Number(req.user.id),
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 20,
        });

        res.json({
            message: "Notifikasi berhasil diambil",
            data,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil notifikasi",
            error: error.message,
        });
    }
});

router.patch("/:id/baca", verifyToken, async(req, res) => {
    try {
        const data = await prisma.notifikasi.update({
            where: {
                id: Number(req.params.id),
            },
            data: {
                dibaca: true,
            },
        });

        res.json({
            message: "Notifikasi ditandai dibaca",
            data,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengubah notifikasi",
            error: error.message,
        });
    }
});

module.exports = router;