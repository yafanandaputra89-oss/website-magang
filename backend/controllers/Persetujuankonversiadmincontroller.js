const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

/**
 * Admin prodi hanya menangani pengajuan yang SUDAH melewati tahap dosen, yaitu
 * status: disetujui_dosen (menunggu validasi admin), disetujui (final), ditolak.
 * Item dengan status "menunggu" (belum disentuh dosen) TIDAK ditampilkan di sini.
 *
 * Mapping label filter frontend -> nilai status asli di DB:
 *   menunggu  -> disetujui_dosen   (menunggu validasi admin prodi)
 *   disetujui -> disetujui          (final, sudah ditetapkan admin)
 *   ditolak   -> ditolak
 */
const FILTER_MAP = {
  menunggu: ["disetujui_dosen"],
  disetujui: ["disetujui"],
  ditolak: ["ditolak"],
};

// NOTE: sesuaikan filter prodi admin ini dengan kolom yg menyimpan cakupan prodi
// admin (mis. req.user.prodiId). Untuk sekarang admin prodi bisa lihat semua,
// silakan tambahkan where tambahan kalau tiap admin cuma boleh lihat prodinya sendiri.

exports.getPengajuanKonversiAdmin = async (req, res) => {
  try {
    const { search = "", status = "semua" } = req.query;

    const statusFilter =
      status !== "semua" && FILTER_MAP[status]
        ? { status: { in: FILTER_MAP[status] } }
        : { status: { in: ["disetujui_dosen", "disetujui", "ditolak"] } };

    const konversi = await prisma.konversiSks.findMany({
      where: {
        lamaran: {
          status: "KONFIRMASI_DITERIMA",
        },
        ...statusFilter,
        ...(search
          ? {
              OR: [
                { kode: { contains: search } },
                { nama: { contains: search } },
                { mahasiswa: { user: { name: { contains: search } } } },
                { mahasiswa: { nim: { contains: search } } },
                { lamaran: { lowongan: { posisi: { contains: search } } } },
                {
                  lamaran: {
                    lowongan: { perusahaan: { nama: { contains: search } } },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        mahasiswa: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        lamaran: {
          include: {
            dosenPembimbing: {
              include: { user: { select: { name: true } } },
            },
            lowongan: { include: { perusahaan: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const grouped = Object.values(
      konversi.reduce((acc, item) => {
        const mhsId = item.mahasiswaId;

        if (!acc[mhsId]) {
          acc[mhsId] = {
            id: item.mahasiswa.id,
            mahasiswa: item.mahasiswa.user?.name || item.lamaran.name || "-",
            nim: item.mahasiswa.nim || "-",
            prodi: item.mahasiswa.prodi || item.lamaran.major || "-",
            semester: item.mahasiswa.semester
              ? `Semester ${item.mahasiswa.semester}`
              : item.lamaran.semester || "-",
            dosenPembimbing:
              item.lamaran.dosenPembimbing?.user?.name || "-",
            tempatMagang: item.lamaran.lowongan?.perusahaan?.nama || "-",
            posisi: item.lamaran.lowongan?.posisi || "-",
            durasiMagang: item.lamaran.duration || "-",
            tanggal: item.createdAt,
            mataKuliah: [],
          };
        }

        acc[mhsId].mataKuliah.push({
          id: item.id,
          kode: item.kode,
          nama: item.nama,
          sks: item.sks,
          kategori: item.kategori,
          status: item.status, // disetujui_dosen | disetujui | ditolak
          keterangan: item.keterangan,
          cpmk: item.cpmk ? JSON.parse(item.cpmk) : [],
          objektif: item.objektif || "",
        });

        return acc;
      }, {})
    );

    const allMK = konversi;
    const stats = {
      totalMahasiswa: grouped.length,
      totalMK: allMK.length,
      menungguMK: allMK.filter((item) => item.status === "disetujui_dosen").length,
      disetujuiMK: allMK.filter((item) => item.status === "disetujui").length,
      ditolakMK: allMK.filter((item) => item.status === "ditolak").length,
      totalSksDisetujui: allMK
        .filter((item) => item.status === "disetujui")
        .reduce((s, item) => s + (item.sks || 0), 0),
    };

    return res.json({
      message: "Data pengajuan konversi berhasil diambil",
      data: grouped,
      stats,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil pengajuan konversi",
      error: error.message,
    });
  }
};

exports.updateStatusKonversiAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, keterangan } = req.body;

    const allowedStatus = ["disetujui", "ditolak"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    if (status === "ditolak" && !keterangan) {
      return res.status(400).json({
        message: "Keterangan wajib diisi jika menolak pengajuan",
      });
    }

    const pengajuan = await prisma.konversiSks.findFirst({
      where: { id: Number(id) },
      include: {
        mahasiswa: { include: { user: true } },
      },
    });

    if (!pengajuan) {
      return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    }

    // Admin prodi hanya boleh memvalidasi yang sudah direkomendasikan dosen
    if (pengajuan.status !== "disetujui_dosen") {
      return res.status(400).json({
        message:
          pengajuan.status === "menunggu"
            ? "Pengajuan ini belum direview dosen pembimbing"
            : "Pengajuan ini sudah final diproses",
      });
    }

    const updated = await prisma.konversiSks.update({
      where: { id: Number(id) },
      data: {
        status,
        keterangan:
          keterangan ||
          (status === "disetujui"
            ? "Dokumen lengkap dan valid. SKS disetujui oleh admin prodi."
            : "Ditolak oleh admin prodi."),
      },
    });

    await prisma.notifikasi.create({
      data: {
        userId: pengajuan.mahasiswa.userId,
        judul:
          status === "disetujui"
            ? "Konversi SKS Disetujui Admin Prodi"
            : "Konversi SKS Ditolak Admin Prodi",
        pesan: `Pengajuan konversi mata kuliah ${pengajuan.nama} telah ${status} oleh admin prodi.`,
      },
    });

    await createAuditLog({
      req,
      user: req.user,
      action: "UPDATE_KONVERSI_SKS_ADMIN",
      description: `Admin prodi ${status} pengajuan konversi ${pengajuan.nama}`,
      module: "Validasi Konversi SKS - Admin Prodi",
      status: "BERHASIL",
    });

    return res.json({
      message:
        status === "disetujui"
          ? "Pengajuan berhasil disetujui final"
          : "Pengajuan berhasil ditolak",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal memperbarui status pengajuan",
      error: error.message,
    });
  }
};