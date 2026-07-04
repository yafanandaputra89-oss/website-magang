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

        return res.json({
            message: "Data notifikasi berhasil diambil",
            data,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil notifikasi",
            error: error.message,
        });
    }
});

router.patch("/:id/baca", verifyToken, async(req, res) => {
    try {
        await prisma.notifikasi.update({
            where: {
                id: Number(req.params.id),
            },
            data: {
                dibaca: true,
            },
        });

        return res.json({
            message: "Notifikasi ditandai dibaca",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal update notifikasi",
            error: error.message,
        });
    }
});

module.exports = router;