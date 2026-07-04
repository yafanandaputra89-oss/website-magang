const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

/* ── Helper: ambil profil perusahaan dari user login ─────────────────────── */
async function getPerusahaan(userId) {
  return prisma.perusahaan.findUnique({ where: { userId } });
}

/* ── Helper: pastikan lamaran ini benar milik lowongan perusahaan login ───── */
async function getLamaranMilikPerusahaan(lamaranId, perusahaanId) {
  const lamaran = await prisma.lamaran.findFirst({
    where: {
      id: Number(lamaranId),
      lowongan: { perusahaanId },
    },
    include: {
      lowongan: true,
      mahasiswa: { include: { user: { select: { name: true, email: true } } } },
      magang: { include: { penilaians: { orderBy: { createdAt: "desc" } } } },
      laporanMagang: { orderBy: { tanggal: "desc" } },
    },
  });
  return lamaran;
}

/* ── Helper: mapping 1 baris lamaran+magang jadi bentuk yang dipakai FE ───── */
function mapPeserta(lamaran) {
  return {
    id: lamaran.id, // pakai id lamaran sebagai id utama di FE
    nama: lamaran.mahasiswa.name || lamaran.mahasiswa.user?.name || lamaran.name,
    nim: lamaran.mahasiswa.nim || "-",
    prodi: lamaran.mahasiswa.prodi || lamaran.major || "-",
    universitas: lamaran.university,
    email: lamaran.mahasiswa.user?.email || lamaran.email,
    telepon: lamaran.mahasiswa.telepon || lamaran.phone,
    posisi: lamaran.lowongan.posisi,
    pembimbing: lamaran.magang?.pembimbingPerusahaan || "-",
    mulai: lamaran.magang?.tanggalMulai || lamaran.startDate,
    selesai: lamaran.magang?.tanggalSelesai || null,
    status: lamaran.magang?.status || "Aktif",
    logbook: (lamaran.laporanMagang || []).map((l) => ({
      id: l.id,
      tanggal: l.tanggal,
      judul: l.judul,
      status: l.status === "DISETUJUI" ? "Disetujui" : "Menunggu Review",
    })),
    penilaian: (lamaran.magang?.penilaians || []).map((p) => ({
      id: p.id,
      periode: p.periode,
      nilai: p.nilai,
      feedback: p.feedback,
    })),
  };
}

/* ════════════════════════════════════════════════════════════════
   GET /api/perusahaan/mahasiswa-magang
   List semua mahasiswa yang sedang/pernah magang di perusahaan login.
   Syarat: lamaran punya record `magang` (dibuat otomatis saat mahasiswa
   konfirmasi penerimaan — lihat patch di lamaran.controller.js).
════════════════════════════════════════════════════════════════ */
exports.getMahasiswaMagang = async (req, res) => {
  try {
    const perusahaan = await getPerusahaan(req.user.id);
    if (!perusahaan) {
      return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
    }

    const lamarans = await prisma.lamaran.findMany({
      where: {
        lowongan: { perusahaanId: perusahaan.id },
        magang: { isNot: null },
      },
      include: {
        lowongan: true,
        mahasiswa: { include: { user: { select: { name: true, email: true } } } },
        magang: { include: { penilaians: { orderBy: { createdAt: "desc" } } } },
        laporanMagang: { orderBy: { tanggal: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = lamarans.map(mapPeserta);

    res.json({ message: "Daftar mahasiswa magang berhasil diambil", data });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data mahasiswa magang", error: error.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   GET /api/perusahaan/mahasiswa-magang/:id
   Detail satu peserta (id = lamaranId), termasuk logbook & penilaian lengkap.
════════════════════════════════════════════════════════════════ */
exports.getMahasiswaMagangDetail = async (req, res) => {
  try {
    const perusahaan = await getPerusahaan(req.user.id);
    if (!perusahaan) {
      return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
    }

    const lamaran = await getLamaranMilikPerusahaan(req.params.id, perusahaan.id);
    if (!lamaran) {
      return res.status(404).json({ message: "Data peserta magang tidak ditemukan" });
    }

    res.json({ message: "Detail mahasiswa magang berhasil diambil", data: mapPeserta(lamaran) });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil detail mahasiswa magang", error: error.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   PATCH /api/perusahaan/mahasiswa-magang/:id/status
   Body: { status: "Aktif" | "Selesai" | "Cuti" | "Dropout", tanggalSelesai?, catatan? }
════════════════════════════════════════════════════════════════ */
exports.updateStatusMagang = async (req, res) => {
  try {
    const { status, tanggalSelesai, catatan } = req.body;
    const allowed = ["Aktif", "Selesai", "Cuti", "Dropout"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Status magang tidak valid" });
    }

    const perusahaan = await getPerusahaan(req.user.id);
    if (!perusahaan) {
      return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
    }

    const lamaran = await getLamaranMilikPerusahaan(req.params.id, perusahaan.id);
    if (!lamaran || !lamaran.magang) {
      return res.status(404).json({ message: "Data magang tidak ditemukan" });
    }

    const updated = await prisma.magang.update({
      where: { id: lamaran.magang.id },
      data: {
        status,
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : lamaran.magang.tanggalSelesai,
        catatan: catatan ?? lamaran.magang.catatan,
      },
    });

    try {
      await createAuditLog({
        req,
        user: req.user,
        action: "UPDATE_STATUS_MAGANG",
        description: `Status magang ${lamaran.mahasiswa.name || lamaran.name} diubah menjadi ${status}`,
        module: "Magang",
        status: "BERHASIL",
      });
    } catch (e) {
      console.error("AUDIT LOG ERROR:", e.message);
    }

    res.json({ message: "Status magang berhasil diperbarui", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui status magang", error: error.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   POST /api/perusahaan/mahasiswa-magang/:id/penilaian
   Body: { periode, nilai (0-100), feedback }
════════════════════════════════════════════════════════════════ */
exports.createPenilaian = async (req, res) => {
  try {
    const { periode, nilai, feedback } = req.body;

    if (!periode || nilai === undefined || !feedback) {
      return res.status(400).json({ message: "Periode, nilai, dan feedback wajib diisi" });
    }

    const nilaiNumber = Number(nilai);
    if (Number.isNaN(nilaiNumber) || nilaiNumber < 0 || nilaiNumber > 100) {
      return res.status(400).json({ message: "Nilai harus berupa angka 0-100" });
    }

    const perusahaan = await getPerusahaan(req.user.id);
    if (!perusahaan) {
      return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
    }

    const lamaran = await getLamaranMilikPerusahaan(req.params.id, perusahaan.id);
    if (!lamaran || !lamaran.magang) {
      return res.status(404).json({ message: "Data magang tidak ditemukan" });
    }

    const penilaian = await prisma.penilaianPerusahaan.create({
      data: {
        magangId: lamaran.magang.id,
        periode,
        nilai: nilaiNumber,
        feedback,
        dinilaiOlehUserId: req.user.id,
      },
    });

    try {
      await createAuditLog({
        req,
        user: req.user,
        action: "CREATE_PENILAIAN",
        description: `${perusahaan.nama || "Perusahaan"} memberi penilaian (${periode}) untuk ${lamaran.mahasiswa.name || lamaran.name}`,
        module: "Magang",
        status: "BERHASIL",
      });
    } catch (e) {
      console.error("AUDIT LOG ERROR:", e.message);
    }

    res.status(201).json({ message: "Penilaian berhasil disimpan", data: penilaian });
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan penilaian", error: error.message });
  }
};