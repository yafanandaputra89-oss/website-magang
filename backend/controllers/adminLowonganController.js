const prisma = require("../config/prisma");

// ── Helper ──────────────────────────────────────────────────────────────────

/**
 * Hitung inisial dari nama perusahaan (maks 2 huruf).
 * Contoh: "PT Maju Teknologi" → "PM"
 */
function getInitials(nama = "") {
    return nama
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

/**
 * Format tanggal ke "DD Mon YYYY" (misal "15 Jul 2026").
 */
function formatTanggal(date) {
    if (!date) return null;
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ── GET /admin/lowongan ──────────────────────────────────────────────────────
/**
 * Ambil semua lowongan dari seluruh perusahaan.
 * Query params opsional:
 *   - search  : filter nama perusahaan / posisi / departemen
 *   - status  : "Aktif" | "Pending" | "Bermasalah" | "Ditolak"
 *   - tab     : "semua" | "kurasi" | "bermasalah"
 *   - page    : nomor halaman (default 1)
 *   - limit   : jumlah per halaman (default 10)
 */
exports.getAllLowongan = async (req, res) => {
    try {
        const { search = "", status = "", tab = "semua", page = 1, limit = 10 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        // ── Susun filter where ──
        const where = {};

        // Filter status eksplisit
        if (status) {
            where.status = status;
        }

        // Filter per tab
        if (tab === "kurasi") {
            where.status = "Pending";
        } else if (tab === "bermasalah") {
            where.status = "Bermasalah";
        }

        // Filter search: posisi, departemen, atau nama perusahaan
        if (search) {
            where.OR = [
                { posisi: { contains: search } },
                { departemen: { contains: search } },
                { perusahaan: { nama: { contains: search } } },
            ];
        }

        const [total, lowongans] = await Promise.all([
            prisma.lowongan.count({ where }),
            prisma.lowongan.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: "desc" },
                include: {
                    perusahaan: {
                        select: {
                            id: true,
                            nama: true,
                            bidang: true,
                            logo: true,
                            statusVerifikasi: true,
                        },
                    },
                    _count: {
                        select: { lamarans: true },
                    },
                },
            }),
        ]);

        // ── Hitung stat cards ──
        const [totalAll, totalPending, totalAktif, totalBermasalah] = await Promise.all([
            prisma.lowongan.count(),
            prisma.lowongan.count({ where: { status: "Pending" } }),
            prisma.lowongan.count({ where: { status: "Aktif" } }),
            prisma.lowongan.count({ where: { status: "Bermasalah" } }),
        ]);

        // ── Format response data ──
        const data = lowongans.map((l) => ({
            id: l.id,
            initials: getInitials(l.perusahaan?.nama),
            company: l.perusahaan?.nama ?? "-",
            perusahaanId: l.perusahaanId,
            position: l.posisi,
            bidang: l.departemen ?? l.perusahaan?.bidang ?? "-",
            kuota: l.kuota,
            batas: formatTanggal(l.deadline),
            status: l.status,
            reported: l.status === "Bermasalah",
            jumlahPelamar: l._count.lamarans,
            createdAt: l.createdAt,
        }));

        res.json({
            message: "Data lowongan berhasil diambil",
            stats: {
                total: totalAll,
                pending: totalPending,
                aktif: totalAktif,
                bermasalah: totalBermasalah,
            },
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
            data,
        });
    } catch (error) {
        console.error("[getAllLowongan]", error);
        res.status(500).json({ message: "Gagal mengambil data lowongan", error: error.message });
    }
};

// ── GET /admin/lowongan/:id ──────────────────────────────────────────────────
/**
 * Detail satu lowongan beserta pelamar dan lamaran terkait.
 */
exports.getLowonganById = async (req, res) => {
    try {
        const { id } = req.params;

        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(id) },
            include: {
                perusahaan: true,
                lamarans: {
                    include: {
                        mahasiswa: {
                            select: { name: true, nim: true, prodi: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { lamarans: true } },
            },
        });

        if (!lowongan) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        res.json({
            message: "Detail lowongan berhasil diambil",
            data: {
                ...lowongan,
                initials: getInitials(lowongan.perusahaan?.nama),
            },
        });
    } catch (error) {
        console.error("[getLowonganById]", error);
        res.status(500).json({ message: "Gagal mengambil detail lowongan", error: error.message });
    }
};

// ── PATCH /admin/lowongan/:id/setujui ───────────────────────────────────────
/**
 * Kurasi: setujui lowongan Pending → Aktif.
 */
exports.setujuiLowongan = async (req, res) => {
    try {
        const { id } = req.params;

        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(id) },
        });

        if (!lowongan) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        if (lowongan.status !== "Pending") {
            return res.status(400).json({
                message: `Lowongan tidak bisa disetujui, status saat ini: ${lowongan.status}`,
            });
        }

        const updated = await prisma.lowongan.update({
            where: { id: Number(id) },
            data: { status: "Aktif" },
        });

        // Notifikasi ke user perusahaan (opsional – skip jika tabel Notifikasi
        // belum siap dikaitkan ke perusahaan)
        try {
            const perusahaan = await prisma.perusahaan.findUnique({
                where: { id: lowongan.perusahaanId },
                select: { userId: true, nama: true },
            });

            if (perusahaan) {
                await prisma.notifikasi.create({
                    data: {
                        userId: perusahaan.userId,
                        judul: "Lowongan Disetujui",
                        pesan: `Lowongan "${lowongan.posisi}" dari ${perusahaan.nama} telah disetujui dan kini aktif tayang.`,
                    },
                });
            }
        } catch (_) {
            // Notifikasi gagal tidak block response
        }

        res.json({ message: "Lowongan berhasil disetujui", data: updated });
    } catch (error) {
        console.error("[setujuiLowongan]", error);
        res.status(500).json({ message: "Gagal menyetujui lowongan", error: error.message });
    }
};

// ── PATCH /admin/lowongan/:id/tolak ─────────────────────────────────────────
/**
 * Kurasi: tolak lowongan Pending → Ditolak.
 * Body: { alasan: string }
 */
exports.tolakLowongan = async (req, res) => {
    try {
        const { id } = req.params;
        const { alasan = "" } = req.body;

        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(id) },
        });

        if (!lowongan) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        if (lowongan.status !== "Pending") {
            return res.status(400).json({
                message: `Lowongan tidak bisa ditolak, status saat ini: ${lowongan.status}`,
            });
        }

        const updated = await prisma.lowongan.update({
            where: { id: Number(id) },
            data: { status: "Ditolak" },
        });

        // Notifikasi ke perusahaan
        try {
            const perusahaan = await prisma.perusahaan.findUnique({
                where: { id: lowongan.perusahaanId },
                select: { userId: true, nama: true },
            });

            if (perusahaan) {
                await prisma.notifikasi.create({
                    data: {
                        userId: perusahaan.userId,
                        judul: "Lowongan Ditolak",
                        pesan: `Lowongan "${lowongan.posisi}" ditolak oleh admin prodi.${alasan ? ` Alasan: ${alasan}` : ""}`,
                    },
                });
            }
        } catch (_) {
            // Notifikasi gagal tidak block response
        }

        res.json({ message: "Lowongan berhasil ditolak", data: updated });
    } catch (error) {
        console.error("[tolakLowongan]", error);
        res.status(500).json({ message: "Gagal menolak lowongan", error: error.message });
    }
};

// ── DELETE /admin/lowongan/:id ───────────────────────────────────────────────
/**
 * Hapus lowongan bermasalah beserta semua data terkait (cascade via Prisma).
 * Body: { alasan: string }
 */
exports.hapusLowongan = async (req, res) => {
    try {
        const { id } = req.params;
        const { alasan = "" } = req.body;

        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(id) },
            include: { perusahaan: { select: { userId: true, nama: true } } },
        });

        if (!lowongan) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        // Kirim notifikasi sebelum dihapus (relasi akan cascade delete)
        try {
            if (lowongan.perusahaan?.userId) {
                await prisma.notifikasi.create({
                    data: {
                        userId: lowongan.perusahaan.userId,
                        judul: "Lowongan Dihapus",
                        pesan: `Lowongan "${lowongan.posisi}" telah dihapus oleh admin prodi.${alasan ? ` Alasan: ${alasan}` : ""}`,
                    },
                });
            }
        } catch (_) {
            // Notifikasi gagal tidak block response
        }

        await prisma.lowongan.delete({ where: { id: Number(id) } });

        res.json({ message: "Lowongan berhasil dihapus" });
    } catch (error) {
        console.error("[hapusLowongan]", error);
        res.status(500).json({ message: "Gagal menghapus lowongan", error: error.message });
    }
};

// ── PATCH /admin/lowongan/:id/tandai-bermasalah ─────────────────────────────
/**
 * Tandai lowongan aktif sebagai Bermasalah.
 * Body: { alasan: string }
 */
exports.tandaiBermasalah = async (req, res) => {
    try {
        const { id } = req.params;
        const { alasan = "" } = req.body;

        const lowongan = await prisma.lowongan.findUnique({
            where: { id: Number(id) },
        });

        if (!lowongan) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        const updated = await prisma.lowongan.update({
            where: { id: Number(id) },
            data: { status: "Bermasalah" },
        });

        // Notifikasi ke perusahaan
        try {
            const perusahaan = await prisma.perusahaan.findUnique({
                where: { id: lowongan.perusahaanId },
                select: { userId: true },
            });

            if (perusahaan) {
                await prisma.notifikasi.create({
                    data: {
                        userId: perusahaan.userId,
                        judul: "Lowongan Ditandai Bermasalah",
                        pesan: `Lowongan "${lowongan.posisi}" ditandai bermasalah oleh admin prodi.${alasan ? ` Alasan: ${alasan}` : ""}`,
                    },
                });
            }
        } catch (_) {
            // Notifikasi gagal tidak block response
        }

        res.json({ message: "Lowongan berhasil ditandai bermasalah", data: updated });
    } catch (error) {
        console.error("[tandaiBermasalah]", error);
        res.status(500).json({ message: "Gagal menandai lowongan bermasalah", error: error.message });
    }
};