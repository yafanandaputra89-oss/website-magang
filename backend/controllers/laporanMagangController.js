const prisma = require("../config/prisma");
const cloudinary = require("../config/cloudinary");

/* ═══════════════════════════════════════════════════════════════
   MAHASISWA — Upload laporan magang
   POST /api/laporan-magang/upload
   Body (multipart): { lamaranId, tanggal, judul, catatan }
   File: "file" (PDF/Word/Excel/Image)
═══════════════════════════════════════════════════════════════ */
exports.uploadLaporanMagang = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lamaranId, tanggal, judul, catatan } = req.body;

    if (!lamaranId || !tanggal || !judul) {
      return res.status(400).json({
        message: "lamaranId, tanggal, dan judul wajib diisi",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "File laporan wajib diupload",
      });
    }

    // Ambil profil mahasiswa
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(userId) },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: "Data mahasiswa tidak ditemukan" });
    }

    // Ambil lamaran beserta dosen pembimbing yang sudah ditetapkan
    const lamaran = await prisma.lamaran.findFirst({
      where: {
        id: Number(lamaranId),
        mahasiswaId: mahasiswa.id,
      },
      include: {
        dosenPembimbing: true,
        lowongan: { include: { perusahaan: true } },
      },
    });

    if (!lamaran) {
      return res.status(404).json({ message: "Data lamaran tidak ditemukan" });
    }

    // Mahasiswa harus sudah konfirmasi diterima
    if (lamaran.status !== "KONFIRMASI_DITERIMA") {
      return res.status(403).json({
        message: "Mahasiswa belum mengonfirmasi diterima magang",
      });
    }

    // Dosen pembimbing harus sudah ditetapkan (dosenPembimbingId terisi)
    if (!lamaran.dosenPembimbingId) {
      return res.status(403).json({
        message:
          "Dosen pembimbing belum ditetapkan. Selesaikan pengajuan dosen pembimbing terlebih dahulu.",
      });
    }

    // Buat laporan — dosenId otomatis dari dosenPembimbingId lamaran
    const laporan = await prisma.laporanMagang.create({
      data: {
        lamaranId: lamaran.id,
        mahasiswaId: mahasiswa.id,
        dosenId: lamaran.dosenPembimbingId,
        tanggal: new Date(tanggal),
        judul,
        catatan: catatan || null,
        fileUrl: `/uploads/laporan/${req.file.filename}`,
        status: "MENUNGGU_REVIEW",
      },
      include: {
        dosen: { include: { user: { select: { name: true, email: true } } } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });

    // Kirim notifikasi ke dosen pembimbing (non-blocking)
    try {
      await prisma.notifikasi.create({
        data: {
          userId: laporan.dosen.userId,
          lamaranId: lamaran.id,
          judul: "Laporan Magang Baru",
          pesan: `${mahasiswa.nama || "Mahasiswa"} mengirim laporan baru: "${judul}"`,
          dibaca: false,
        },
      });
    } catch (notifErr) {
      console.error("Notifikasi gagal:", notifErr.message);
    }

    return res.status(201).json({
      message: `Laporan berhasil dikirim ke dosen pembimbing (${laporan.dosen.user?.name})`,
      data: laporan,
    });
  } catch (error) {
    console.error("UPLOAD LAPORAN ERROR:", error);
    return res.status(500).json({
      message: "Gagal mengupload laporan magang",
      error: error.message,
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   MAHASISWA — Ambil laporan aktif (lamaran + dosen pembimbing)
   GET /api/laporan-magang/info-aktif
   Dipakai frontend untuk prefill lamaranId & info dosen
═══════════════════════════════════════════════════════════════ */
exports.getInfoAktifMahasiswa = async (req, res) => {
  try {
    const userId = req.user.id;

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(userId) },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: "Data mahasiswa tidak ditemukan" });
    }

    // Cari lamaran yang sudah konfirmasi diterima
    const lamaran = await prisma.lamaran.findFirst({
      where: {
        mahasiswaId: mahasiswa.id,
        status: "KONFIRMASI_DITERIMA",
      },
      include: {
        dosenPembimbing: {
          include: { user: { select: { name: true, email: true } } },
        },
        lowongan: { include: { perusahaan: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!lamaran) {
      return res.status(404).json({
        message: "Belum ada magang aktif dengan status KONFIRMASI_DITERIMA",
      });
    }

    // Ambil info pengajuan dosen (untuk statusPengajuan di response)
    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { lamaranId: lamaran.id },
    });

    const sudahAdaDosen = !!lamaran.dosenPembimbingId;

    return res.json({
      message: "Info magang aktif berhasil diambil",
      data: {
        lamaranId: lamaran.id,
        perusahaan: lamaran.lowongan?.perusahaan?.nama || "-",
        posisi: lamaran.lowongan?.posisi || "-",
        dosenPembimbing: lamaran.dosenPembimbing
          ? {
              id: lamaran.dosenPembimbing.id,
              nama: lamaran.dosenPembimbing.user?.name || "-",
              email: lamaran.dosenPembimbing.user?.email || "-",
            }
          : null,
        sudahAdaDosen,
        statusPengajuan: pengajuan?.status || null,
      },
    });
  } catch (error) {
    console.error("GET INFO AKTIF ERROR:", error);
    return res.status(500).json({
      message: "Gagal mengambil info magang aktif",
      error: error.message,
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   MAHASISWA — Ambil semua laporan milik saya
   GET /api/laporan-magang/mahasiswa
═══════════════════════════════════════════════════════════════ */
exports.getLaporanMahasiswa = async (req, res) => {
  try {
    const userId = req.user.id;

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(userId) },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: "Data mahasiswa tidak ditemukan" });
    }

    const laporan = await prisma.laporanMagang.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        dosen: {
          include: { user: { select: { name: true, email: true } } },
        },
        lamaran: {
          include: {
            lowongan: { include: { perusahaan: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = laporan.map((l) => ({
      id: l.id,
      judul: l.judul,
      tanggal: l.tanggal,
      catatan: l.catatan,
      fileUrl: l.fileUrl,
      status: l.status,        // MENUNGGU_REVIEW | SUDAH_DINILAI
      nilai: l.nilai,
      feedback: l.feedback,
      dikirim: l.createdAt,
      dosen: {
        nama: l.dosen?.user?.name || "-",
        email: l.dosen?.user?.email || "-",
      },
      perusahaan: l.lamaran?.lowongan?.perusahaan?.nama || "-",
      posisi: l.lamaran?.lowongan?.posisi || "-",
    }));

    return res.json({
      message: "Data laporan mahasiswa berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET LAPORAN MAHASISWA ERROR:", error);
    return res.status(500).json({
      message: "Gagal mengambil laporan mahasiswa",
      error: error.message,
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DOSEN — Ambil semua laporan mahasiswa bimbingan (dikelompokkan)
   GET /api/laporan-magang/dosen
═══════════════════════════════════════════════════════════════ */
exports.getLaporanDosen = async (req, res) => {
  try {
    const userId = req.user.id;

    const dosen = await prisma.dosen.findUnique({
      where: { userId: Number(userId) },
    });
    if (!dosen) {
      return res.status(404).json({ message: "Data dosen tidak ditemukan" });
    }

    const laporan = await prisma.laporanMagang.findMany({
      where: { dosenId: dosen.id },
      include: {
        mahasiswa: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        lamaran: {
          include: {
            lowongan: { include: { perusahaan: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Kelompokkan per mahasiswa
    const grouped = laporan.reduce((acc, item) => {
      const mhsId = item.mahasiswaId;

      if (!acc[mhsId]) {
        acc[mhsId] = {
          id: item.mahasiswa.id,
          nama: item.mahasiswa.user?.name || item.mahasiswa.nama || "-",
          nim: item.mahasiswa.nim || "-",
          prodi: item.mahasiswa.prodi || "-",
          perusahaan: item.lamaran?.lowongan?.perusahaan?.nama || "-",
          bidang: item.lamaran?.lowongan?.posisi || "-",
          durasi: item.lamaran?.duration || "-",
          laporan: [],
        };
      }

      acc[mhsId].laporan.push({
        id: item.id,
        tanggal: item.tanggal,
        judul: item.judul,
        catatan: item.feedback || "",
        // "MENUNGGU_REVIEW" → "Belum Dinilai", "SUDAH_DINILAI" → "Sudah Dinilai"
        status: item.status === "SUDAH_DINILAI" ? "Sudah Dinilai" : "Belum Dinilai",
        nilai: item.nilai ?? null,
        file: item.fileUrl
          ? {
              name: item.fileUrl.split("/").pop(),
              url: item.fileUrl,
            }
          : null,
        dikirim: item.createdAt,
      });

      return acc;
    }, {});

    // Hitung minggu & progres
    const data = Object.values(grouped).map((mhs) => {
      const sorted = [...mhs.laporan].sort(
        (a, b) => new Date(a.dikirim) - new Date(b.dikirim)
      );
      const withMinggu = sorted.map((l, idx) => ({ ...l, minggu: idx + 1 }));

      const totalLaporan = withMinggu.length;
      const sudahDinilai = withMinggu.filter(
        (l) => l.status === "Sudah Dinilai"
      ).length;

      return {
        ...mhs,
        laporan: withMinggu,
        totalLaporan,
        progres: totalLaporan
          ? Math.round((sudahDinilai / totalLaporan) * 100)
          : 0,
      };
    });

    return res.json({
      message: "Data laporan dosen berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET LAPORAN DOSEN ERROR:", error);
    return res.status(500).json({
      message: "Gagal mengambil laporan dosen",
      error: error.message,
    });
  }
};

/* ═══════════════════════════════════════════════════════════════
   DOSEN — Beri nilai pada laporan
   PATCH /api/laporan-magang/dosen/:laporanId/review
   Body: { nilai (0–100), catatan? }
═══════════════════════════════════════════════════════════════ */
exports.reviewLaporanDosen = async (req, res) => {
  try {
    const userId = req.user.id;
    const { laporanId } = req.params;
    const { nilai, catatan } = req.body;

    if (nilai === undefined || nilai === null) {
      return res.status(400).json({ message: "Nilai wajib diisi" });
    }
    const nilaiNum = Number(nilai);
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      return res
        .status(400)
        .json({ message: "Nilai harus berupa angka antara 0 sampai 100" });
    }

    const dosen = await prisma.dosen.findUnique({
      where: { userId: Number(userId) },
    });
    if (!dosen) {
      return res.status(404).json({ message: "Data dosen tidak ditemukan" });
    }

    // Pastikan laporan ini milik bimbingan dosen ini
    const laporan = await prisma.laporanMagang.findFirst({
      where: {
        id: Number(laporanId),
        dosenId: dosen.id,
      },
      include: {
        mahasiswa: { include: { user: true } },
      },
    });
    if (!laporan) {
      return res.status(404).json({
        message: "Laporan tidak ditemukan atau bukan bimbingan dosen ini",
      });
    }

    const updated = await prisma.laporanMagang.update({
      where: { id: Number(laporanId) },
      data: {
        nilai: nilaiNum,
        feedback: catatan || null,
        status: "SUDAH_DINILAI",
      },
    });

    // Notifikasi ke mahasiswa (non-blocking)
    try {
      await prisma.notifikasi.create({
        data: {
          userId: laporan.mahasiswa.userId,
          lamaranId: laporan.lamaranId,
          judul: "Laporan Anda Telah Dinilai",
          pesan: `Laporan "${laporan.judul}" mendapat nilai ${nilaiNum}.${
            catatan ? ` Catatan dosen: ${catatan}` : ""
          }`,
          dibaca: false,
        },
      });
    } catch (notifErr) {
      console.error("Notifikasi gagal:", notifErr.message);
    }

    return res.json({
      message: "Penilaian laporan berhasil disimpan",
      data: updated,
    });
  } catch (error) {
    console.error("REVIEW LAPORAN ERROR:", error);
    return res.status(500).json({
      message: "Gagal menyimpan penilaian laporan",
      error: error.message,
    });
  }
};