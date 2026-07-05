const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

/**
 * ALUR STATUS (field `status` di tabel konversiSks, tetap String, tidak perlu ubah tipe):
 *   menunggu          -> mahasiswa mengajukan, menunggu review dosen
 *   disetujui_dosen   -> dosen sudah setuju, diteruskan ke admin prodi utk validasi final
 *   ditolak           -> ditolak (baik oleh dosen maupun admin prodi)
 *   disetujui         -> disetujui final oleh admin prodi
 *
 * Catatan: tab filter di frontend dosen tetap "menunggu" / "disetujui" / "ditolak" / "semua".
 * Mapping dari label frontend -> nilai status asli di DB dilakukan di FILTER_MAP di bawah.
 */
const FILTER_MAP = {
  menunggu: ["menunggu"],
  disetujui: ["disetujui_dosen", "disetujui"], // dosen tetap lihat yg sudah dia setujui walau status akhirnya berubah di admin
  ditolak: ["ditolak"],
};

exports.getPengajuanKonversiDosen = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search = "", status = "semua" } = req.query;

    const dosen = await prisma.dosen.findUnique({
      where: { userId },
    });

    if (!dosen) {
      return res.status(404).json({
        message: "Data dosen tidak ditemukan. Lengkapi profil dosen terlebih dahulu.",
        data: [],
      });
    }

    const statusFilter =
      status !== "semua" && FILTER_MAP[status] ? { status: { in: FILTER_MAP[status] } } : {};

    const konversi = await prisma.konversiSks.findMany({
      where: {
        lamaran: {
          dosenPembimbingId: dosen.id,
          status: "KONFIRMASI_DITERIMA",
        },
        ...statusFilter,
        ...(search
          ? {
              OR: [
                { kode: { contains: search } },
                { nama: { contains: search } },
                {
                  mahasiswa: {
                    user: {
                      name: { contains: search },
                    },
                  },
                },
                {
                  mahasiswa: {
                    nim: { contains: search },
                  },
                },
                {
                  lamaran: {
                    lowongan: {
                      posisi: { contains: search },
                    },
                  },
                },
                {
                  lamaran: {
                    lowongan: {
                      perusahaan: {
                        nama: { contains: search },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        mahasiswa: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        lamaran: {
          include: {
            lowongan: {
              include: {
                perusahaan: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
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
          status: item.status, // menunggu | disetujui_dosen | disetujui | ditolak
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
      menungguMK: allMK.filter((item) => item.status === "menunggu").length,
      disetujuiMK: allMK.filter((item) =>
        ["disetujui_dosen", "disetujui"].includes(item.status)
      ).length,
      ditolakMK: allMK.filter((item) => item.status === "ditolak").length,
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

exports.updateStatusKonversiDosen = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, keterangan } = req.body; // status dari frontend tetap "disetujui" | "ditolak"

    const allowedStatus = ["disetujui", "ditolak"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid",
      });
    }

    if (status === "ditolak" && !keterangan) {
      return res.status(400).json({
        message: "Keterangan wajib diisi jika menolak pengajuan",
      });
    }

    const dosen = await prisma.dosen.findUnique({
      where: { userId },
    });

    if (!dosen) {
      return res.status(404).json({
        message: "Data dosen tidak ditemukan",
      });
    }

    const pengajuan = await prisma.konversiSks.findFirst({
      where: {
        id: Number(id),
        lamaran: {
          dosenPembimbingId: dosen.id,
          status: "KONFIRMASI_DITERIMA",
        },
      },
      include: {
        mahasiswa: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!pengajuan) {
      return res.status(404).json({
        message: "Pengajuan tidak ditemukan atau bukan mahasiswa bimbingan Anda",
      });
    }

    if (pengajuan.status !== "menunggu") {
      return res.status(400).json({
        message: "Pengajuan ini sudah diproses",
      });
    }

    // Dosen hanya bisa: teruskan ke admin prodi (disetujui_dosen), atau tolak langsung.
    const dbStatus = status === "disetujui" ? "disetujui_dosen" : "ditolak";

    const updated = await prisma.konversiSks.update({
      where: { id: Number(id) },
      data: {
        status: dbStatus,
        keterangan:
          keterangan ||
          (status === "disetujui"
            ? "Direkomendasikan oleh dosen pembimbing, menunggu validasi admin prodi."
            : "Ditolak oleh dosen pembimbing."),
      },
    });

    await prisma.notifikasi.create({
      data: {
        userId: pengajuan.mahasiswa.userId,
        judul:
          status === "disetujui"
            ? "Konversi SKS Direkomendasikan Dosen"
            : "Konversi SKS Ditolak",
        pesan:
          status === "disetujui"
            ? `Pengajuan konversi mata kuliah ${pengajuan.nama} direkomendasikan dosen, menunggu validasi admin prodi.`
            : `Pengajuan konversi mata kuliah ${pengajuan.nama} telah ditolak.`,
      },
    });

    await createAuditLog({
      req,
      user: req.user,
      action: "UPDATE_KONVERSI_SKS",
      description: `Dosen ${status} pengajuan konversi ${pengajuan.nama}`,
      module: "Persetujuan Konversi SKS",
      status: "BERHASIL",
    });

    return res.json({
      message:
        status === "disetujui"
          ? "Pengajuan berhasil diteruskan ke admin prodi"
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