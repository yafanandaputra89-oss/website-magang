const prisma = require("../config/prisma");

const VALID_STATUS = [
    "PENDING_BERKAS",
    "BERKAS_DITERIMA",
    "BERKAS_DITOLAK",
    "INTERVIEW_DIJADWALKAN",
    "LOLOS_INTERVIEW",
    "TIDAK_LOLOS_INTERVIEW",
    "DITERIMA_MAGANG",
    "DITOLAK",
];

const NOTIF_COPY = {
    BERKAS_DITERIMA: {
        judul: "Berkas Disetujui",
        pesan: "Berkas Anda disetujui dan lanjut ke tahap berikutnya.",
    },
    BERKAS_DITOLAK: {
        judul: "Berkas Ditolak",
        pesan: "Mohon maaf, berkas Anda belum lolos seleksi.",
    },
    INTERVIEW_DIJADWALKAN: {
        judul: "Interview Dijadwalkan",
        pesan: "Jadwal interview Anda sudah ditentukan.",
    },
    LOLOS_INTERVIEW: {
        judul: "Lolos Interview",
        pesan: "Selamat, Anda lolos tahap interview.",
    },
    TIDAK_LOLOS_INTERVIEW: {
        judul: "Tidak Lolos Interview",
        pesan: "Mohon maaf, Anda belum lolos tahap interview.",
    },
    DITERIMA_MAGANG: {
        judul: "Diterima Magang",
        pesan: "Selamat, Anda diterima magang.",
    },
    DITOLAK: {
        judul: "Lamaran Ditolak",
        pesan: "Mohon maaf, lamaran Anda belum diterima.",
    },
};

const getPerusahaanByUser = async(userId) => {
    return prisma.perusahaan.findUnique({
        where: { userId: Number(userId) },
    });
};

const buatNotifikasi = async(userId, lamaranId, status) => {
    const copy = NOTIF_COPY[status];
    if (!copy) return;

    await prisma.notifikasi.create({
        data: {
            userId,
            lamaranId,
            judul: copy.judul,
            pesan: copy.pesan,
        },
    });
};

exports.getPelamarPerusahaan = async(req, res) => {
    try {
        const perusahaan = await getPerusahaanByUser(req.user.id);

        if (!perusahaan && req.user.role !== "admin") {
            return res.status(404).json({
                message: "Profil perusahaan belum dibuat",
                data: [],
            });
        }

        const where =
            req.user.role === "admin" ? {} : {
                lowongan: {
                    perusahaanId: perusahaan.id,
                },
            };

        const lamarans = await prisma.lamaran.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                jadwalInterview: true,
                lowongan: {
                    include: {
                        perusahaan: true,
                    },
                },
                mahasiswa: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                        skills: true,
                        pengalamans: true,
                        pendidikans: true,
                    },
                },
            },
        });

        return res.json({
            message: "Data pelamar berhasil diambil",
            data: lamarans,
        });
    } catch (error) {
        console.error("ERROR GET PELAMAR PERUSAHAAN:", error);
        return res.status(500).json({
            message: "Gagal mengambil data pelamar",
            error: error.message,
        });
    }
};

exports.updateStatusPelamar = async(req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;

        if (!VALID_STATUS.includes(status)) {
            return res.status(400).json({
                message: "Status tidak valid",
            });
        }

        const lamaran = await prisma.lamaran.update({
            where: { id: Number(id) },
            data: {
                status,
            },
            include: {
                jadwalInterview: true,
                lowongan: {
                    include: {
                        perusahaan: true,
                    },
                },
                mahasiswa: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });

        await buatNotifikasi(
            lamaran.mahasiswa.user.id,
            lamaran.id,
            status
        );

        return res.json({
            message: "Status lamaran berhasil diperbarui",
            data: lamaran,
        });
    } catch (error) {
        console.error("ERROR UPDATE STATUS PELAMAR:", error);
        return res.status(500).json({
            message: "Gagal memperbarui status lamaran",
            error: error.message,
        });
    }
};

exports.jadwalkanInterview = async(req, res) => {
    try {
        const { id } = req.params;
        const { tanggal, jam, lokasi, linkMeeting } = req.body;

        if (!tanggal || !jam || !lokasi) {
            return res.status(400).json({
                message: "Tanggal, jam, dan lokasi wajib diisi",
            });
        }

        const lamaran = await prisma.lamaran.findUnique({
            where: { id: Number(id) },
            include: {
                mahasiswa: {
                    include: {
                        user: true,
                    },
                },
                lowongan: {
                    include: {
                        perusahaan: true,
                    },
                },
            },
        });

        if (!lamaran) {
            return res.status(404).json({
                message: "Lamaran tidak ditemukan",
            });
        }

        const jadwal = await prisma.jadwalInterview.upsert({
            where: {
                lamaranId: Number(id),
            },
            create: {
                lamaranId: Number(id),
                tanggal: new Date(tanggal),
                jam,
                lokasi,
                linkMeeting: linkMeeting || null,
            },
            update: {
                tanggal: new Date(tanggal),
                jam,
                lokasi,
                linkMeeting: linkMeeting || null,
            },
        });

        const updatedLamaran = await prisma.lamaran.update({
            where: { id: Number(id) },
            data: {
                status: "INTERVIEW_DIJADWALKAN",
            },
            include: {
                jadwalInterview: true,
                lowongan: {
                    include: {
                        perusahaan: true,
                    },
                },
                mahasiswa: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        await buatNotifikasi(
            lamaran.mahasiswa.user.id,
            lamaran.id,
            "INTERVIEW_DIJADWALKAN"
        );

        return res.json({
            message: "Jadwal interview berhasil disimpan",
            data: {
                lamaran: updatedLamaran,
                jadwalInterview: jadwal,
            },
        });
    } catch (error) {
        console.error("ERROR JADWALKAN INTERVIEW:", error);
        return res.status(500).json({
            message: "Gagal membuat jadwal interview",
            error: error.message,
        });
    }
};