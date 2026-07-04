const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

const getMahasiswaAktifMagang = async (userId) => {
  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId },
  });

  if (!mahasiswa) {
    return {
      error: "Data mahasiswa tidak ditemukan",
      mahasiswa: null,
      lamaran: null,
    };
  }

  const lamaran = await prisma.lamaran.findFirst({
    where: {
      mahasiswaId: mahasiswa.id,
      // ── FIX: Harus sudah KONFIRMASI_DITERIMA (bukan cuma ditawarkan/DITERIMA_MAGANG) ──
      status: "KONFIRMASI_DITERIMA",
      dosenPembimbingId: {
        not: null,
      },
    },
    include: {
      dosenPembimbing: true,
      lowongan: {
        include: {
          perusahaan: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!lamaran) {
    return {
      error:
        "Konversi SKS hanya bisa diajukan jika mahasiswa sudah mengkonfirmasi penerimaan magang dan sudah mendapat dosen pembimbing",
      mahasiswa,
      lamaran: null,
    };
  }

  return {
    error: null,
    mahasiswa,
    lamaran,
  };
};

exports.getKonversiSks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = "semua" } = req.query;

    const result = await getMahasiswaAktifMagang(userId);

    if (result.error) {
      return res.status(403).json({
        message: result.error,
        data: [],
        eligible: false,
      });
    }

    const where = {
      mahasiswaId: result.mahasiswa.id,
      lamaranId: result.lamaran.id,
      ...(status !== "semua" ? { status } : {}),
    };

    const data = await prisma.konversiSks.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    const allData = await prisma.konversiSks.findMany({
      where: {
        mahasiswaId: result.mahasiswa.id,
        lamaranId: result.lamaran.id,
      },
    });

    const totalSks = allData.reduce((total, item) => total + item.sks, 0);
    const sksDisetujui = allData
      .filter((item) => item.status === "disetujui")
      .reduce((total, item) => total + item.sks, 0);
    const sksMenunggu = allData
      .filter((item) => item.status === "menunggu")
      .reduce((total, item) => total + item.sks, 0);
    const sksDitolak = allData
      .filter((item) => item.status === "ditolak")
      .reduce((total, item) => total + item.sks, 0);

    return res.json({
      message: "Data konversi SKS berhasil diambil",
      eligible: true,
      magang: {
        lamaranId: result.lamaran.id,
        perusahaan: result.lamaran.lowongan?.perusahaan?.nama || "-",
        posisi: result.lamaran.lowongan?.posisi || "-",
        dosenPembimbing: result.lamaran.dosenPembimbing?.name || "-",
      },
      data,
      stats: {
        totalSks,
        sksDisetujui,
        sksMenunggu,
        sksDitolak,
        jumlahPengajuan: allData.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil data konversi SKS",
      error: error.message,
    });
  }
};

exports.createKonversiSks = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      kode,
      nama,
      sks,
      kategori,
      prodi,
      cpmk = [],
      objektif,
    } = req.body;

    if (!kode || !nama || !sks || !kategori) {
      return res.status(400).json({
        message: "Kode, nama mata kuliah, SKS, dan kategori wajib diisi",
      });
    }

    const result = await getMahasiswaAktifMagang(userId);

    if (result.error) {
      return res.status(403).json({
        message: result.error,
      });
    }

    const konversi = await prisma.konversiSks.create({
      data: {
        mahasiswaId: result.mahasiswa.id,
        lamaranId: result.lamaran.id,
        kode,
        nama,
        sks: Number(sks),
        kategori,
        prodi: prodi || null,
        cpmk: Array.isArray(cpmk) ? JSON.stringify(cpmk) : cpmk,
        objektif: objektif || null,
        status: "menunggu",
        keterangan: "Pengajuan manual — sedang menunggu review koordinator",
      },
    });

    await createAuditLog({
      req,
      user: req.user,
      action: "CREATE_KONVERSI_SKS",
      description: `Mahasiswa mengajukan konversi SKS untuk mata kuliah ${nama}`,
      module: "Konversi SKS",
      status: "BERHASIL",
    });

    return res.status(201).json({
      message: "Pengajuan konversi SKS berhasil dikirim",
      data: konversi,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengajukan konversi SKS",
      error: error.message,
    });
  }
};

exports.getDetailKonversiSks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await getMahasiswaAktifMagang(userId);

    if (result.error) {
      return res.status(403).json({
        message: result.error,
      });
    }

    const data = await prisma.konversiSks.findFirst({
      where: {
        id: Number(id),
        mahasiswaId: result.mahasiswa.id,
      },
    });

    if (!data) {
      return res.status(404).json({
        message: "Data konversi SKS tidak ditemukan",
      });
    }

    return res.json({
      message: "Detail konversi SKS berhasil diambil",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil detail konversi SKS",
      error: error.message,
    });
  }
};

exports.deleteKonversiSks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await getMahasiswaAktifMagang(userId);

    if (result.error) {
      return res.status(403).json({
        message: result.error,
      });
    }

    const data = await prisma.konversiSks.findFirst({
      where: {
        id: Number(id),
        mahasiswaId: result.mahasiswa.id,
      },
    });

    if (!data) {
      return res.status(404).json({
        message: "Data konversi SKS tidak ditemukan",
      });
    }

    if (data.status === "disetujui") {
      return res.status(400).json({
        message: "Pengajuan yang sudah disetujui tidak bisa dihapus",
      });
    }

    await prisma.konversiSks.delete({
      where: {
        id: Number(id),
      },
    });

    return res.json({
      message: "Pengajuan konversi SKS berhasil dihapus",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal menghapus konversi SKS",
      error: error.message,
    });
  }
};