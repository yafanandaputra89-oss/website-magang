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
      // laporanMagang TIDAK di-include lagi — logbook tidak dipakai di endpoint ini
    },
  });
  return lamaran;
}

/* ── Helper: kirim notifikasi (silent-fail, tidak boleh gagalkan request utama) ── */
async function kirimNotifikasi(userId, lamaranId, judul, pesan) {
  try {
    await prisma.notifikasi.create({
      data: { userId, lamaranId, judul, pesan, dibaca: false },
    });
  } catch (e) {
    console.error("NOTIF ERROR:", e.message);
  }
}

/* ── Helper: sinkronkan status Pengajuan Dosen Pembimbing saat Magang
   diubah menjadi "Selesai". Hanya berlaku kalau bimbingan sedang
   BIMBINGAN_AKTIF — kalau belum ada pengajuan, atau pengajuan belum aktif
   (masih menunggu persetujuan / ditolak), tidak disentuh sama sekali.
   Tidak butuh field/kolom baru: status "SELESAI" sudah ada di enum
   StatusPengajuanDosen pada schema.prisma. ─────────────────────────────── */
async function selesaikanBimbinganJikaAda(lamaranId, actor) {
  try {
    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { lamaranId: Number(lamaranId) },
      include: {
        mahasiswa: { include: { user: true } },
        dosenDitetapkan: { include: { user: true } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });

    if (!pengajuan || pengajuan.status !== "BIMBINGAN_AKTIF") return;

    const namaPerusahaan = pengajuan.lamaran?.lowongan?.perusahaan?.nama || "Perusahaan";
    const namaDosen = pengajuan.dosenDitetapkan?.user?.name || "dosen pembimbing";
    const namaMahasiswa = pengajuan.mahasiswa?.user?.name || pengajuan.mahasiswa?.name || "Mahasiswa";

    await prisma.pengajuanDosenPembimbing.update({
      where: { id: pengajuan.id },
      data: { status: "SELESAI" },
    });

    await prisma.riwayatStatusPengajuan.create({
      data: {
        pengajuanId: pengajuan.id,
        status: "SELESAI",
        keterangan: `Magang telah ditandai Selesai oleh ${namaPerusahaan}, bimbingan otomatis diselesaikan`,
        changedById: actor?.id || null,
        changedByRole: actor?.role || "perusahaan",
      },
    });

    await kirimNotifikasi(
      pengajuan.mahasiswa.userId,
      pengajuan.lamaranId,
      "Bimbingan Magang Selesai",
      `Magang Anda di ${namaPerusahaan} telah ditandai selesai. Bimbingan dengan ${namaDosen} juga otomatis diselesaikan.`
    );

    if (pengajuan.dosenDitetapkan) {
      await kirimNotifikasi(
        pengajuan.dosenDitetapkan.userId,
        pengajuan.lamaranId,
        "Bimbingan Magang Selesai",
        `Magang ${namaMahasiswa} di ${namaPerusahaan} telah ditandai selesai oleh perusahaan. Bimbingan Anda dengan mahasiswa ini otomatis diselesaikan.`
      );
    }
  } catch (e) {
    // Kegagalan sinkronisasi TIDAK boleh menggagalkan update status magang itu sendiri —
    // cukup dicatat di log server untuk ditindaklanjuti manual kalau perlu.
    console.error("SYNC PENGAJUAN DOSEN -> SELESAI ERROR:", e.message);
  }
}

/* ── Helper: mapping 1 baris lamaran+magang jadi bentuk yang dipakai FE ───── */
/*    NOTE: field "logbook" sudah dihapus dari sini. Data laporanMagang di    */
/*    database TIDAK dihapus/diubah — cuma tidak lagi diquery/ditampilkan     */
/*    lewat endpoint mahasiswa-magang ini.                                   */
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
    catatan: lamaran.magang?.catatan || null,
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
        // laporanMagang TIDAK di-include lagi
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
   Detail satu peserta (id = lamaranId).
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
   Body: { status: "Aktif" | "Selesai" | "Cuti" | "Dropout",
           tanggalMulai?, tanggalSelesai?, catatan? }

   Perusahaan mengubah status magang (misal Aktif -> Selesai / Cuti)
   sekaligus opsional update tanggal mulai/selesai & catatan.
   - tanggalMulai opsional: kalau tidak dikirim, nilai lama dipertahankan.
   - tanggalSelesai wajib (baru ATAU sudah ada sebelumnya) kalau status
     yang dipilih adalah "Selesai".
════════════════════════════════════════════════════════════════ */
exports.updateStatusMagang = async (req, res) => {
  try {
    const { status, tanggalMulai, tanggalSelesai, catatan } = req.body;
    const allowed = ["Aktif", "Selesai", "Cuti", "Dropout"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Status magang tidak valid" });
    }

    let mulaiDate = null;
    if (tanggalMulai) {
      mulaiDate = new Date(tanggalMulai);
      if (isNaN(mulaiDate.getTime())) {
        return res.status(400).json({ message: "Format tanggal mulai tidak valid" });
      }
    }

    let selesaiDate = null;
    if (tanggalSelesai) {
      selesaiDate = new Date(tanggalSelesai);
      if (isNaN(selesaiDate.getTime())) {
        return res.status(400).json({ message: "Format tanggal selesai tidak valid" });
      }
    }

    const perusahaan = await getPerusahaan(req.user.id);
    if (!perusahaan) {
      return res.status(404).json({ message: "Profil perusahaan belum dibuat" });
    }

    const lamaran = await getLamaranMilikPerusahaan(req.params.id, perusahaan.id);
    if (!lamaran || !lamaran.magang) {
      return res.status(404).json({ message: "Data magang tidak ditemukan" });
    }

    // Tanggal mulai wajib ada (baru atau sudah ada sebelumnya)
    const finalMulai = mulaiDate || lamaran.magang.tanggalMulai;
    if (!finalMulai) {
      return res.status(400).json({ message: "Tanggal mulai wajib diisi" });
    }

    // Tanggal selesai wajib diisi (baru atau sudah ada sebelumnya) kalau status "Selesai"
    const finalSelesai = selesaiDate || lamaran.magang.tanggalSelesai;
    if (status === "Selesai" && !finalSelesai) {
      return res.status(400).json({ message: "Tanggal selesai wajib diisi untuk status Selesai" });
    }

    if (finalMulai && finalSelesai && finalSelesai < finalMulai) {
      return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
    }

    const updated = await prisma.magang.update({
      where: { id: lamaran.magang.id },
      data: {
        status,
        tanggalMulai: finalMulai,
        tanggalSelesai: finalSelesai,
        catatan: catatan ?? lamaran.magang.catatan,
      },
    });

    // ── Sinkronisasi: kalau status magang jadi "Selesai", ikut selesaikan
    //    bimbingan dosen (PengajuanDosenPembimbing) yang sedang aktif untuk
    //    lamaran ini. Tidak berlaku untuk status lain (Aktif/Cuti/Dropout).
    if (status === "Selesai") {
      await selesaikanBimbinganJikaAda(lamaran.id, req.user);
    }

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

/* ══════════════════════════════════════════════════════════════════════════
   ══════════════════════ SISI MAHASISWA ═════════════════════════════════════
   ══════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   GET /api/mahasiswa/magang/info-aktif
   Dipakai dashboard mahasiswa untuk kartu "Magang Mulai" & "Magang Selesai".

   404 kalau mahasiswa belum KONFIRMASI_DITERIMA di lamaran manapun —
   BUKAN error fatal, frontend sudah handle ini via try/catch terpisah.
════════════════════════════════════════════════════════════════ */
exports.getInfoAktifMahasiswa = async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: "Profil mahasiswa belum dibuat" });
    }

    const lamaranAktif = await prisma.lamaran.findFirst({
      where: {
        mahasiswaId: mahasiswa.id,
        status: "KONFIRMASI_DITERIMA",
      },
      include: {
        lowongan: { include: { perusahaan: true } },
        magang: true, // ── field yang dibutuhkan: tanggalMulai, tanggalSelesai, status
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lamaranAktif) {
      return res.status(404).json({ message: "Belum ada magang aktif" });
    }

    return res.json({
      message: "Info aktif berhasil diambil",
      data: {
        lamaranId: lamaranAktif.id,
        perusahaan: lamaranAktif.lowongan?.perusahaan?.nama || "-",
        posisi: lamaranAktif.lowongan?.posisi || "-",
        tanggalMulai: lamaranAktif.magang?.tanggalMulai || lamaranAktif.startDate,
        tanggalSelesai: lamaranAktif.magang?.tanggalSelesai || null,
        statusMagang: lamaranAktif.magang?.status || "Aktif",
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil info aktif",
      error: error.message,
    });
  }
};