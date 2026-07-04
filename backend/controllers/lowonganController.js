const prisma = require("../config/prisma");
const slugify = require("slugify");

const getPerusahaan = async(userId) => {
    return await prisma.perusahaan.findUnique({ where: { userId } });
};

// ── Helper: generate slug unik dari posisi ────────────────────────────────────
const generateUniqueSlug = async (posisi) => {
    const base = slugify(posisi, { lower: true, strict: true });
    let slug;
    let isUnique = false;

    while (!isUnique) {
        const suffix = Math.random().toString(36).substring(2, 8);
        slug = `${base}-${suffix}`;
        const existing = await prisma.lowongan.findUnique({ where: { slug } });
        if (!existing) isUnique = true;
    }

    return slug;
};

exports.getLowongan = async(req, res) => {
    try {
        const perusahaan = await getPerusahaan(req.user.id);
        if (!perusahaan) {
            return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
        }

        const lowongan = await prisma.lowongan.findMany({
            where: { perusahaanId: perusahaan.id },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { pelamars: true } },
            },
        });

        res.json({ message: "Lowongan berhasil diambil", data: lowongan });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil lowongan", error: error.message });
    }
};

// ── CREATE — status default PENDING, bukan Aktif ──────────────────────────────
exports.createLowongan = async(req, res) => {
    try {
        const perusahaan = await getPerusahaan(req.user.id);
        if (!perusahaan) {
            return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
        }

        // Perusahaan harus sudah diverifikasi sebelum bisa posting lowongan
        if (perusahaan.statusVerifikasi !== "DITERIMA") {
            return res.status(403).json({
                message: "Akun perusahaan belum diverifikasi admin. Tidak dapat membuat lowongan.",
            });
        }

        const {
            posisi,
            departemen,
            tipe,
            durasi,
            kuota,
            target,
            tags,
            gaji,
            lokasi,
            experience,
            deadline,
            deskripsi,
            responsibilities,
            requirements,
            whoYouAre,
            niceToHave,
        } = req.body;

        // generate slug unik dari posisi
        const slug = await generateUniqueSlug(posisi);

        const lowongan = await prisma.lowongan.create({
            data: {
                perusahaanId: perusahaan.id,
                slug,
                posisi,
                departemen,
                tipe,
                durasi,
                kuota: Number(kuota),
                target: Number(target),
                tags: JSON.stringify(tags || []),
                gaji,
                lokasi,
                experience,
                deadline: deadline ? new Date(deadline) : null,
                deskripsi,
                responsibilities: JSON.stringify(responsibilities || []),
                requirements: JSON.stringify(requirements || []),
                whoYouAre: JSON.stringify(whoYouAre || []),
                niceToHave: JSON.stringify(niceToHave || []),
                status: "Pending", // lowongan baru selalu masuk kurasi
            },
        });

        res.status(201).json({
            message: "Lowongan berhasil dibuat dan sedang menunggu kurasi admin",
            data: lowongan,
        });
    } catch (error) {
        res.status(500).json({ message: "Gagal membuat lowongan", error: error.message });
    }
};

// ── UPDATE — perusahaan boleh edit kapan saja, status TIDAK direset ke Pending ─
exports.updateLowongan = async(req, res) => {
    try {
        const { id } = req.params;
        const perusahaan = await getPerusahaan(req.user.id);
        if (!perusahaan) {
            return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
        }

        const existing = await prisma.lowongan.findFirst({
            where: { id: Number(id), perusahaanId: perusahaan.id },
        });

        if (!existing) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        // ✅ Opsi A: tidak ada blokir status apapun — perusahaan bebas edit
        // termasuk saat status Aktif, Pending, Ditolak, maupun Bermasalah.

        // regenerate slug jika posisi berubah, agar slug tetap relevan
        let slugUpdate = {};
        if (req.body.posisi && req.body.posisi !== existing.posisi) {
            const newSlug = await generateUniqueSlug(req.body.posisi);
            slugUpdate = { slug: newSlug };
        }

        const lowongan = await prisma.lowongan.update({
            where: { id: Number(id) },
            data: {
                posisi: req.body.posisi,
                ...slugUpdate,
                departemen: req.body.departemen,
                tipe: req.body.tipe,
                durasi: req.body.durasi,
                kuota: Number(req.body.kuota),
                target: Number(req.body.target),
                tags: JSON.stringify(req.body.tags || []),
                gaji: req.body.gaji,
                lokasi: req.body.lokasi,
                experience: req.body.experience,
                deadline: req.body.deadline ? new Date(req.body.deadline) : null,
                deskripsi: req.body.deskripsi,
                responsibilities: JSON.stringify(req.body.responsibilities || []),
                requirements: JSON.stringify(req.body.requirements || []),
                whoYouAre: JSON.stringify(req.body.whoYouAre || []),
                niceToHave: JSON.stringify(req.body.niceToHave || []),
                // ✅ status TIDAK diubah — tetap seperti sebelumnya (Aktif tetap Aktif, dst)
            },
        });

        res.json({
            message: "Lowongan berhasil diperbarui",
            data: lowongan,
        });
    } catch (error) {
        res.status(500).json({ message: "Gagal update lowongan", error: error.message });
    }
};

// ── DELETE — perusahaan boleh hapus kapan saja, termasuk yang Aktif ───────────
exports.deleteLowongan = async(req, res) => {
    try {
        const perusahaan = await getPerusahaan(req.user.id);
        if (!perusahaan) {
            return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
        }

        const existing = await prisma.lowongan.findFirst({
            where: { id: Number(req.params.id), perusahaanId: perusahaan.id },
        });

        if (!existing) {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        // ✅ Opsi A: tidak ada blokir status — boleh hapus meski Aktif

        await prisma.lowongan.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Lowongan berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: "Gagal hapus lowongan", error: error.message });
    }
};

// ── PUBLIC — hanya yang Aktif ─────────────────────────────────────────────────
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

        res.json({ message: "Lowongan publik berhasil diambil", data: lowongan });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil lowongan publik", error: error.message });
    }
};

exports.getPublicLowonganBySlug = async(req, res) => {
    try {
        const lowongan = await prisma.lowongan.findUnique({
            where: { slug: req.params.slug },
            include: { perusahaan: true, pelamars: true },
        });

        if (!lowongan || lowongan.status !== "Aktif") {
            return res.status(404).json({ message: "Lowongan tidak ditemukan" });
        }

        res.json({ message: "Detail lowongan berhasil diambil", data: lowongan });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil detail lowongan", error: error.message });
    }
};