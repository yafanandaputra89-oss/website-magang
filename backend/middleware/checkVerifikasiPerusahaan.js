const prisma = require("../config/prisma");

/**
 * Middleware: hanya izinkan perusahaan dengan status DITERIMA
 * untuk melakukan aksi tertentu (misal: posting lowongan)
 */
exports.checkVerifikasiPerusahaan = async(req, res, next) => {
    try {
        const userId = req.user.id;

        const perusahaan = await prisma.perusahaan.findUnique({
            where: { userId },
            select: { statusVerifikasi: true, nama: true },
        });

        if (!perusahaan) {
            return res.status(404).json({
                message: "Profil perusahaan belum dibuat. Lengkapi profil perusahaan Anda terlebih dahulu.",
            });
        }

        if (perusahaan.statusVerifikasi === "MENUNGGU") {
            return res.status(403).json({
                message: "Akun perusahaan Anda masih menunggu verifikasi admin. Anda belum dapat memposting lowongan.",
                statusVerifikasi: "MENUNGGU",
            });
        }

        if (perusahaan.statusVerifikasi === "DITOLAK") {
            return res.status(403).json({
                message: "Akun perusahaan Anda ditolak oleh admin. Silakan hubungi admin untuk informasi lebih lanjut.",
                statusVerifikasi: "DITOLAK",
            });
        }

        // statusVerifikasi === "DITERIMA" → lanjut
        next();
    } catch (error) {
        return res.status(500).json({
            message: "Gagal memeriksa status verifikasi perusahaan",
            error: error.message,
        });
    }
};