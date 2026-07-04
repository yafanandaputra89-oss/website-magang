const prisma = require("../config/prisma");

exports.getPerusahaanVerifikasi = async(req, res) => {
    try {
        const data = await prisma.perusahaan.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });

        return res.json({
            message: "Data perusahaan berhasil diambil",
            data,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil data perusahaan",
            error: error.message,
        });
    }
};

exports.updateStatusVerifikasi = async(req, res) => {
    try {
        const { id } = req.params;
        const { statusVerifikasi, catatanVerifikasi } = req.body;

        const allowedStatus = ["MENUNGGU", "DITERIMA", "DITOLAK"];

        if (!allowedStatus.includes(statusVerifikasi)) {
            return res.status(400).json({
                message: "Status verifikasi tidak valid",
            });
        }

        const perusahaan = await prisma.perusahaan.update({
            where: {
                id: Number(id),
            },
            data: {
                statusVerifikasi,
                catatanVerifikasi: catatanVerifikasi || null,
                tanggalVerifikasi: new Date(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });

        return res.json({
            message: statusVerifikasi === "DITERIMA" ?
                "Perusahaan berhasil diverifikasi" : "Perusahaan berhasil ditolak",
            data: perusahaan,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengubah status verifikasi perusahaan",
            error: error.message,
        });
    }
};
exports.updateStatusVerifikasi = async(req, res) => {
    try {
        const { id } = req.params;
        const { statusVerifikasi, catatanVerifikasi } = req.body;

        const allowedStatus = ["MENUNGGU", "DITERIMA", "DITOLAK"];
        if (!allowedStatus.includes(statusVerifikasi)) {
            return res.status(400).json({ message: "Status verifikasi tidak valid" });
        }

        const perusahaan = await prisma.perusahaan.update({
            where: { id: Number(id) },
            data: {
                statusVerifikasi,
                catatanVerifikasi: catatanVerifikasi || null,
                tanggalVerifikasi: new Date(),
            },
            include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
        });

        // ── Kirim notifikasi ke perusahaan ──
        const judulNotif =
            statusVerifikasi === "DITERIMA" ? "Akun Perusahaan Terverifikasi" :
            statusVerifikasi === "DITOLAK" ? "Verifikasi Perusahaan Ditolak" :
            "Status Verifikasi Diperbarui";

        const pesanNotif =
            statusVerifikasi === "DITERIMA" ?
            "Selamat! Akun perusahaan Anda telah diverifikasi. Anda sekarang dapat memposting lowongan." :
            statusVerifikasi === "DITOLAK" ?
            `Maaf, verifikasi akun perusahaan Anda ditolak. ${catatanVerifikasi || ""}` :
            "Status verifikasi akun perusahaan Anda telah diperbarui menjadi MENUNGGU.";

        await prisma.notifikasi.create({
            data: {
                userId: perusahaan.userId,
                judul: judulNotif,
                pesan: pesanNotif,
            },
        });

        return res.json({
            message: statusVerifikasi === "DITERIMA" ?
                "Perusahaan berhasil diverifikasi" : "Perusahaan berhasil ditolak",
            data: perusahaan,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengubah status verifikasi perusahaan",
            error: error.message,
        });
    }
};