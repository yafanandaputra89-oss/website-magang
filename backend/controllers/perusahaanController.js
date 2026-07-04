const prisma = require("../config/prisma");

exports.getDashboardPerusahaan = async(req, res) => {
    try {
        const userId = req.user.id;

        const perusahaan = await prisma.perusahaan.findUnique({
            where: { userId },
        });

        if (!perusahaan) {
            return res.status(404).json({
                message: "Profil perusahaan belum dibuat",
            });
        }

        const lowonganAktif = await prisma.lowongan.count({
            where: {
                perusahaanId: perusahaan.id,
                status: "Aktif",
            },
        });

        const totalPelamar = await prisma.pelamar.count({
            where: {
                lowongan: {
                    perusahaanId: perusahaan.id,
                },
            },
        });

        const pelamarMenunggu = await prisma.pelamar.count({
            where: {
                status: "Menunggu Review",
                lowongan: {
                    perusahaanId: perusahaan.id,
                },
            },
        });

        const mahasiswaDiterima = await prisma.pelamar.count({
            where: {
                status: "Diterima",
                lowongan: {
                    perusahaanId: perusahaan.id,
                },
            },
        });

        const pelamarTerbaru = await prisma.pelamar.findMany({
            where: {
                lowongan: {
                    perusahaanId: perusahaan.id,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 4,
            include: {
                lowongan: true,
            },
        });

        const lowongan = await prisma.lowongan.findMany({
            where: {
                perusahaanId: perusahaan.id,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 5,
        });

        const skillKebutuhan = await prisma.skillKebutuhan.findMany();

        res.json({
            message: "Dashboard perusahaan berhasil diambil",
            data: {
                stats: {
                    lowonganAktif,
                    totalPelamar,
                    pelamarMenunggu,
                    mahasiswaDiterima,
                    rating: 4.3,
                },
                pelamarTerbaru,
                lowongan,
                skillKebutuhan,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil dashboard perusahaan",
            error: error.message,
        });
    }
};