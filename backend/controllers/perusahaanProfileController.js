const prisma = require("../config/prisma");

/**
 * GET - Ambil profil perusahaan
 * Menampilkan semua data perusahaan termasuk galeri
 */
exports.getProfilePerusahaan = async (req, res) => {
  try {
    const userId = req.user.id;

    const perusahaan = await prisma.perusahaan.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        galeri: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!perusahaan) {
      return res.status(404).json({
        message: "Profil perusahaan belum dibuat",
        data: null,
      });
    }

    // ── Transform data: parse nilaiKultur dari JSON string ke array
    const transformedData = {
      ...perusahaan,
      nilaiKultur: perusahaan.nilaiKultur
        ? JSON.parse(perusahaan.nilaiKultur)
        : [],
      // ── Map galeri ke format yang diharapkan frontend
      galeri: perusahaan.galeri.map((item) => ({
        id: item.id.toString(),
        image: item.image,
        label: item.label,
      })),
    };

    res.json({
      message: "Profil perusahaan berhasil diambil",
      data: transformedData,
    });
  } catch (error) {
    console.error("Error getProfilePerusahaan:", error);
    res.status(500).json({
      message: "Gagal mengambil profil perusahaan",
      error: error.message,
    });
  }
};

/**
 * PUT - Simpan atau update profil perusahaan
 * Menerima semua field profil dan galeri
 */
exports.createOrUpdateProfilePerusahaan = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      nama,
      deskripsiSingkat,
      logo,
      bidang,
      alamat,
      telepon,
      ukuran,
      tahunBerdiri,
      website,
      linkedin,
      instagram,
      deskripsi,
      kultur,
      nilaiKultur,
      galeri,
    } = req.body;

    // ── Validasi field yang wajib
    if (!nama || !alamat || !bidang) {
      return res.status(400).json({
        message: "Nama perusahaan, lokasi, dan industri wajib diisi",
      });
    }

    // ── Update atau create perusahaan
    const perusahaan = await prisma.perusahaan.upsert({
      where: { userId },
      update: {
        nama: nama || undefined,
        deskripsiSingkat: deskripsiSingkat || undefined,
        logo: logo || undefined,
        bidang: bidang || undefined,
        alamat: alamat || undefined,
        telepon: telepon || undefined,
        ukuran: ukuran || undefined,
        tahunBerdiri: tahunBerdiri || undefined,
        website: website || undefined,
        linkedin: linkedin || undefined,
        instagram: instagram || undefined,
        deskripsi: deskripsi || undefined,
        kultur: kultur || undefined,
        nilaiKultur: nilaiKultur
          ? JSON.stringify(nilaiKultur)
          : undefined,
      },
      create: {
        userId,
        nama,
        deskripsiSingkat: deskripsiSingkat || null,
        logo: logo || null,
        bidang,
        alamat,
        telepon: telepon || null,
        ukuran: ukuran || null,
        tahunBerdiri: tahunBerdiri || null,
        website: website || null,
        linkedin: linkedin || null,
        instagram: instagram || null,
        deskripsi: deskripsi || null,
        kultur: kultur || null,
        nilaiKultur: nilaiKultur
          ? JSON.stringify(nilaiKultur)
          : null,
      },
    });

    // ── Kelola galeri jika ada
    if (Array.isArray(galeri) && galeri.length > 0) {
      // ── Hapus galeri lama
      await prisma.galeriPerusahaan.deleteMany({
        where: { perusahaanId: perusahaan.id },
      });

      // ── Tambah galeri baru
      await prisma.galeriPerusahaan.createMany({
        data: galeri.map((item) => ({
          perusahaanId: perusahaan.id,
          image: item.image,
          label: item.label,
        })),
      });
    }

    // ── Ambil data yang sudah diupdate
    const updatedProfile = await prisma.perusahaan.findUnique({
      where: { userId },
      include: {
        galeri: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // ── Transform response
    const transformedData = {
      ...updatedProfile,
      nilaiKultur: updatedProfile.nilaiKultur
        ? JSON.parse(updatedProfile.nilaiKultur)
        : [],
      galeri: updatedProfile.galeri.map((item) => ({
        id: item.id.toString(),
        image: item.image,
        label: item.label,
      })),
    };

    res.json({
      message: "Profil perusahaan berhasil disimpan",
      data: transformedData,
    });
  } catch (error) {
    console.error("Error createOrUpdateProfilePerusahaan:", error);

    // ── Handle duplicate field errors
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "data";
      return res.status(409).json({
        message: `${field} yang Anda masukkan sudah digunakan. Periksa kembali isian Anda.`,
      });
    }

    res.status(500).json({
      message: "Gagal menyimpan profil perusahaan",
      error: error.message,
    });
  }
};

/**
 * GET - Ambil semua perusahaan (untuk halaman publik pencarian perusahaan)
 * Tidak butuh login — bisa diakses siapa saja
 */
exports.getAllPerusahaan = async (req, res) => {
  try {
    const daftarPerusahaan = await prisma.perusahaan.findMany({
      select: {
        id: true,
        nama: true,
        logo: true,
        bidang: true,
        alamat: true,
        updatedAt: true,
        // ── Hitung jumlah lowongan milik perusahaan ini
        _count: {
          select: { lowongans: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // ── Helper: ubah updatedAt jadi teks relatif ("2 jam lalu", dst)
    const formatRelativeTime = (date) => {
      const diffMs = Date.now() - new Date(date).getTime();
      const menit = Math.floor(diffMs / 60000);
      if (menit < 1) return "baru saja";
      if (menit < 60) return `${menit} menit lalu`;
      const jam = Math.floor(menit / 60);
      if (jam < 24) return `${jam} jam lalu`;
      const hari = Math.floor(jam / 24);
      return `${hari} hari lalu`;
    };

    const hasil = daftarPerusahaan.map((p) => ({
      id: p.id,
      name: p.nama,
      location: p.alamat,
      industry: p.bidang,
      jobs: p._count.lowongans,
      lastActive: formatRelativeTime(p.updatedAt),
      logo: p.logo, // bisa berupa URL gambar atau null
    }));

    res.json({
      message: "Daftar perusahaan berhasil diambil",
      data: hasil,
    });
  } catch (error) {
    console.error("Error getAllPerusahaan:", error);
    res.status(500).json({
      message: "Gagal mengambil daftar perusahaan",
      error: error.message,
    });
  }
};