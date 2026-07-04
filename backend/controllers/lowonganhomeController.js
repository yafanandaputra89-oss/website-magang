exports.getPublicLowongan = async(req, res) => {
    try {
        const lowongan = await prisma.lowongan.findMany({
            where: { status: "Aktif" },
            include: {
                perusahaan: true,
                pelamars: true,
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            message: "Lowongan publik berhasil diambil",
            data: lowongan,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil lowongan publik",
            error: error.message,
        });
    }
};

exports.getPublicLowonganById = async(req, res) => {
    try {
        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                perusahaan: true,
                pelamars: true,
            },
        });

        if (!lowongan) {
            return res.status(404).json({
                message: "Lowongan tidak ditemukan",
            });
        }

        res.json({
            message: "Detail lowongan berhasil diambil",
            data: lowongan,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil detail lowongan",
            error: error.message,
        });
    }
};