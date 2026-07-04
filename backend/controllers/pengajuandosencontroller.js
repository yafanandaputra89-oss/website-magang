// controllers/pengajuanDosenController.js
const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

/* ═══════════════════════════════════════════════════════════════════════════
   CATATAN PERBAIKAN (FIX)
   ───────────────────────────────────────────────────────────────────────────
   Bug sebelumnya: field `Lamaran.dosenPembimbingId` hanya di-update di fungsi
   `tetapkanDosen` (skenario B — admin menunjuk dosen di awal). Untuk skenario
   A (mahasiswa memilih dosen sendiri), field ini TIDAK PERNAH ter-update
   meskipun status pengajuan sudah mencapai BIMBINGAN_AKTIF — sehingga fitur
   yang bergantung pada `Lamaran.dosenPembimbingId` (seperti Konversi SKS)
   gagal walau bimbingan sebenarnya sudah aktif.

   Fix: ditambahkan helper `aktifkanBimbingan()` yang SELALU mengisi
   `Lamaran.dosenPembimbingId` setiap kali status pengajuan berubah menjadi
   BIMBINGAN_AKTIF, baik lewat jalur:
   - setujuiPermohonan (dosen langsung setuju atas tunjukan admin), maupun
   - sahkanBimbingan   (admin mengesahkan usulan mahasiswa yang sudah
                        disetujui dosen)
═══════════════════════════════════════════════════════════════════════════ */

/* ─── HELPER — tambah riwayat status ─────────────────────────────── */
async function addRiwayat(pengajuanId, status, keterangan, userId, role) {
  return prisma.riwayatStatusPengajuan.create({
    data: {
      pengajuanId,
      status,
      keterangan: keterangan || null,
      changedById: userId || null,
      changedByRole: role || null,
    },
  });
}

/* ─── HELPER — kirim notifikasi ──────────────────────────────────── */
async function kirimNotifikasi(userId, lamaranId, judul, pesan) {
  try {
    await prisma.notifikasi.create({
      data: { userId, lamaranId, judul, pesan, dibaca: false },
    });
  } catch (e) {
    console.error("NOTIF ERROR:", e.message);
  }
}

/* ─── HELPER — kirim notifikasi ke semua admin prodi ─────────────── */
async function notifikasiAdmin(lamaranId, judul, pesan) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    await Promise.all(admins.map((a) => kirimNotifikasi(a.id, lamaranId, judul, pesan)));
  } catch (e) {
    console.error("NOTIF ADMIN ERROR:", e.message);
  }
}

/* ─── HELPER — FIX UTAMA: pastikan Lamaran.dosenPembimbingId selalu
       ter-set setiap kali bimbingan resmi aktif, dari jalur manapun ── */
async function aktifkanBimbingan(pengajuan) {
  if (!pengajuan.dosenDitetapkanId) return;
  await prisma.lamaran.update({
    where: { id: pengajuan.lamaranId },
    data: { dosenPembimbingId: pengajuan.dosenDitetapkanId },
  });
}

exports.buatPengajuan = async (req, res) => {
  try {
    const { lamaranId, dosenUsulanId, alasanMemilih, catatanTambahan } = req.body;

    if (!lamaranId || !alasanMemilih) {
      return res.status(400).json({ message: "lamaranId dan alasanMemilih wajib diisi" });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: "Profil mahasiswa tidak ditemukan" });
    }

    const lamaran = await prisma.lamaran.findUnique({
      where: { id: Number(lamaranId) },
      include: { lowongan: { include: { perusahaan: true } } },
    });
    if (!lamaran) return res.status(404).json({ message: "Lamaran tidak ditemukan" });
    if (lamaran.mahasiswaId !== mahasiswa.id) return res.status(403).json({ message: "Akses ditolak" });
    if (lamaran.status !== "KONFIRMASI_DITERIMA") {
      return res.status(400).json({
        code: "STATUS_NOT_ELIGIBLE",
        message: "Pengajuan dosen pembimbing hanya dapat dilakukan setelah status magang KONFIRMASI_DITERIMA.",
      });
    }

    const existing = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { lamaranId: Number(lamaranId) },
    });
    if (existing && existing.status !== "DITOLAK_DOSEN") {
      return res.status(400).json({
        code: "ALREADY_SUBMITTED",
        message: "Pengajuan dosen pembimbing untuk magang ini sudah ada.",
      });
    }

    // Mahasiswa boleh memilih dosen sendiri (dosenUsulanId diisi), atau
    // kalau kesulitan / tidak tahu mau pilih siapa, cukup kosongkan
    // dosenUsulanId — nanti admin prodi yang akan menunjukkan dosennya.
    const punyaUsulan = !!dosenUsulanId;

    const dataBaru = {
      dosenUsulanId: punyaUsulan ? Number(dosenUsulanId) : null,
      dosenDitetapkanId: punyaUsulan ? Number(dosenUsulanId) : null,
      sumberPenetapan: punyaUsulan ? "MAHASISWA" : null,
      alasanMemilih,
      catatanTambahan: catatanTambahan || null,
      status: punyaUsulan ? "MENUNGGU_PERSETUJUAN_DOSEN" : "MENUNGGU_VERIFIKASI_PRODI",
      alasanPenolakan: null,
    };

    let pengajuan;
    if (existing) {
      pengajuan = await prisma.pengajuanDosenPembimbing.update({
        where: { id: existing.id },
        data: dataBaru,
      });
    } else {
      pengajuan = await prisma.pengajuanDosenPembimbing.create({
        data: { lamaranId: Number(lamaranId), mahasiswaId: mahasiswa.id, ...dataBaru },
      });
    }

    if (punyaUsulan) {
      const dosen = await prisma.dosen.findUnique({ where: { id: Number(dosenUsulanId) }, include: { user: true } });

      await addRiwayat(
        pengajuan.id,
        "MENUNGGU_PERSETUJUAN_DOSEN",
        `Pengajuan dosen pembimbing (usulan mahasiswa: ${dosen?.user?.name || "-"}) dikirim oleh mahasiswa`,
        req.user.id,
        "mahasiswa"
      );

      if (dosen) {
        await kirimNotifikasi(
          dosen.userId,
          Number(lamaranId),
          "Permohonan Bimbingan Magang",
          `Anda mendapat permohonan bimbingan magang dari ${req.user.name || "mahasiswa"} (${lamaran.lowongan?.perusahaan?.nama}).`
        );
      }
    } else {
      await addRiwayat(
        pengajuan.id,
        "MENUNGGU_VERIFIKASI_PRODI",
        "Pengajuan dosen pembimbing dikirim tanpa usulan dosen (mahasiswa kesulitan memilih), menunggu penunjukan admin prodi",
        req.user.id,
        "mahasiswa"
      );

      await notifikasiAdmin(
        Number(lamaranId),
        "Pengajuan Dosen Pembimbing Perlu Ditunjuk",
        `Mahasiswa mengajukan bimbingan untuk magang di ${lamaran.lowongan?.perusahaan?.nama} tanpa usulan dosen. Mohon tunjuk dosen pembimbing.`
      );
    }

    try {
      await createAuditLog({ req, user: req.user, action: "BUAT_PENGAJUAN_DOSEN", description: `Mahasiswa mengajukan dosen pembimbing untuk lamaran #${lamaranId}`, module: "PengajuanDosen", status: "BERHASIL" });
    } catch (e) { console.error("AUDIT:", e.message); }

    return res.status(201).json({ message: "Pengajuan dosen pembimbing berhasil dikirim", data: pengajuan });
  } catch (error) {
    console.error("ERROR BUAT PENGAJUAN:", error);
    return res.status(500).json({ message: "Gagal membuat pengajuan", error: error.message });
  }
};

exports.getPengajuanSaya = async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: Number(req.user.id) } });
    if (!mahasiswa) return res.json({ data: [] });

    const data = await prisma.pengajuanDosenPembimbing.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
        dosenUsulan: { include: { user: { select: { name: true } } } },
        dosenDitetapkan: { include: { user: { select: { name: true } } } },
        riwayatStatus: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data", error: error.message });
  }
};

exports.getAllPengajuan = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== "semua") where.status = status;

    const data = await prisma.pengajuanDosenPembimbing.findMany({
      where,
      include: {
        mahasiswa: { include: { user: { select: { name: true, email: true } } } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
        dosenUsulan: { include: { user: { select: { name: true } } } },
        dosenDitetapkan: { include: { user: { select: { name: true } } } },
        riwayatStatus: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = search
      ? data.filter((d) => {
          const q = search.toLowerCase();
          return (
            d.mahasiswa?.user?.name?.toLowerCase().includes(q) ||
            d.lamaran?.lowongan?.perusahaan?.nama?.toLowerCase().includes(q)
          );
        })
      : data;

    return res.json({ data: filtered });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data", error: error.message });
  }
};

// Admin menunjuk dosen — dipakai ketika mahasiswa kesulitan memilih sendiri
// (status MENUNGGU_VERIFIKASI_PRODI), atau menunjuk pengganti setelah dosen
// sebelumnya menolak (status DITOLAK_DOSEN).
exports.tetapkanDosen = async (req, res) => {
  try {
    const { id } = req.params;
    const { dosenDitetapkanId, catatanProdi } = req.body;

    if (!dosenDitetapkanId) {
      return res.status(400).json({ message: "dosenDitetapkanId wajib diisi" });
    }

    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { id: Number(id) },
      include: {
        mahasiswa: { include: { user: true } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });
    if (!pengajuan) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });

    if (!["MENUNGGU_VERIFIKASI_PRODI", "DITOLAK_DOSEN"].includes(pengajuan.status)) {
      return res.status(400).json({
        code: "STATUS_NOT_ELIGIBLE",
        message: "Dosen hanya bisa ditunjuk admin saat status Menunggu Verifikasi Prodi atau Ditolak Dosen.",
      });
    }

    const dosen = await prisma.dosen.findUnique({ where: { id: Number(dosenDitetapkanId) }, include: { user: true } });
    if (!dosen) return res.status(404).json({ message: "Dosen tidak ditemukan" });

    // Admin yang menunjuk -> sumberPenetapan = ADMIN, sehingga saat dosen setuju
    // nanti akan langsung aktif tanpa perlu pengesahan tambahan.
    const updated = await prisma.pengajuanDosenPembimbing.update({
      where: { id: Number(id) },
      data: {
        dosenDitetapkanId: Number(dosenDitetapkanId),
        sumberPenetapan: "ADMIN",
        status: "MENUNGGU_PERSETUJUAN_DOSEN",
        catatanProdi: catatanProdi || null,
        alasanPenolakan: null,
      },
    });

    // Catatan: dosenPembimbingId di Lamaran baru resmi dipakai untuk fitur
    // lain (konversi SKS, dsb) setelah dosen benar-benar SETUJU, bukan pada
    // saat baru ditunjuk. Baris update di bawah tetap dipertahankan supaya
    // relasi lamaran->dosen sudah terlihat sejak awal ditunjuk, dan akan
    // di-refresh lagi (idempotent) begitu dosen menyetujui.
    await prisma.lamaran.update({
      where: { id: pengajuan.lamaranId },
      data: { dosenPembimbingId: Number(dosenDitetapkanId) },
    });

    await addRiwayat(pengajuan.id, "MENUNGGU_PERSETUJUAN_DOSEN", `Dosen ditunjuk oleh admin prodi: ${dosen.user?.name}`, req.user.id, "admin");

    await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Dosen Pembimbing Ditunjuk",
      `Admin prodi menunjuk dosen pembimbing untuk Anda: ${dosen.user?.name}. Menunggu persetujuan dosen.`);

    await kirimNotifikasi(dosen.userId, pengajuan.lamaranId, "Permohonan Bimbingan Magang",
      `Anda ditunjuk admin prodi sebagai pembimbing untuk ${pengajuan.mahasiswa.user?.name} (${pengajuan.lamaran?.lowongan?.perusahaan?.nama}).`);

    return res.json({ message: "Dosen pembimbing berhasil ditunjuk", data: updated });
  } catch (error) {
    return res.status(500).json({ message: "Gagal menetapkan dosen", error: error.message });
  }
};

// Admin mengesahkan bimbingan — untuk skenario mahasiswa memilih dosen
// sendiri, setelah dosen menyetujui usulan tersebut.
exports.sahkanBimbingan = async (req, res) => {
  try {
    const { id } = req.params;

    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { id: Number(id) },
      include: {
        mahasiswa: { include: { user: true } },
        dosenDitetapkan: { include: { user: true } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });
    if (!pengajuan) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });

    if (pengajuan.status !== "MENUNGGU_PENGESAHAN_ADMIN") {
      return res.status(400).json({
        code: "STATUS_NOT_ELIGIBLE",
        message: "Pengesahan hanya berlaku saat status Menunggu Pengesahan Admin (dosen sudah menyetujui).",
      });
    }

    const updated = await prisma.pengajuanDosenPembimbing.update({
      where: { id: Number(id) },
      data: { status: "BIMBINGAN_AKTIF" },
    });

    // ── FIX: set Lamaran.dosenPembimbingId begitu bimbingan resmi aktif.
    //    Tanpa ini, fitur Konversi SKS tidak akan menganggap mahasiswa
    //    eligible walau statusnya sudah BIMBINGAN_AKTIF.
    await aktifkanBimbingan(pengajuan);

    await addRiwayat(pengajuan.id, "BIMBINGAN_AKTIF", "Bimbingan disahkan oleh admin prodi", req.user.id, "admin");

    await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Bimbingan Magang Aktif",
      `Bimbingan magang Anda bersama ${pengajuan.dosenDitetapkan?.user?.name} telah disahkan oleh admin prodi. Anda sekarang dapat mengajukan konversi SKS.`);

    if (pengajuan.dosenDitetapkan) {
      await kirimNotifikasi(pengajuan.dosenDitetapkan.userId, pengajuan.lamaranId, "Bimbingan Magang Aktif",
        `Bimbingan Anda dengan ${pengajuan.mahasiswa.user?.name} telah disahkan admin prodi dan resmi aktif.`);
    }

    return res.json({ message: "Bimbingan berhasil disahkan", data: updated });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengesahkan bimbingan", error: error.message });
  }
};

exports.getPermohonanDosen = async (req, res) => {
  try {
    const dosen = await prisma.dosen.findUnique({ where: { userId: Number(req.user.id) } });
    if (!dosen) return res.status(404).json({ message: "Profil dosen tidak ditemukan" });

    const data = await prisma.pengajuanDosenPembimbing.findMany({
      where: { dosenDitetapkanId: dosen.id },
      include: {
        mahasiswa: { include: { user: { select: { name: true, email: true } } } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
        riwayatStatus: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil data", error: error.message });
  }
};

exports.setujuiPermohonan = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen = await prisma.dosen.findUnique({ where: { userId: Number(req.user.id) }, include: { user: true } });

    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { id: Number(id) },
      include: {
        mahasiswa: { include: { user: true } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });
    if (!pengajuan) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    if (pengajuan.dosenDitetapkanId !== dosen.id) return res.status(403).json({ message: "Akses ditolak" });
    if (pengajuan.status !== "MENUNGGU_PERSETUJUAN_DOSEN") {
      return res.status(400).json({ message: "Permohonan ini sudah diproses sebelumnya" });
    }

    // Skenario A (usulan mahasiswa) -> perlu pengesahan admin dulu
    // Skenario B (tunjukan admin)   -> langsung aktif
    const statusBerikutnya = pengajuan.sumberPenetapan === "MAHASISWA" ? "MENUNGGU_PENGESAHAN_ADMIN" : "BIMBINGAN_AKTIF";

    const updated = await prisma.pengajuanDosenPembimbing.update({
      where: { id: Number(id) },
      data: { status: statusBerikutnya },
    });

    // ── FIX: kalau langsung BIMBINGAN_AKTIF (skenario admin menunjuk),
    //    pastikan Lamaran.dosenPembimbingId ikut ter-set di sini juga —
    //    supaya konsisten walau tetapkanDosen sudah pernah mengisinya.
    if (statusBerikutnya === "BIMBINGAN_AKTIF") {
      await aktifkanBimbingan(pengajuan);
    }

    await addRiwayat(pengajuan.id, statusBerikutnya, "Permohonan bimbingan disetujui oleh dosen", req.user.id, "dosen");

    if (statusBerikutnya === "MENUNGGU_PENGESAHAN_ADMIN") {
      await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Dosen Menyetujui Bimbingan",
        `Dosen pembimbing ${dosen.user?.name} telah menyetujui permohonan Anda. Menunggu pengesahan admin prodi.`);
      await notifikasiAdmin(pengajuan.lamaranId, "Bimbingan Menunggu Pengesahan",
        `Dosen ${dosen.user?.name} telah menyetujui bimbingan untuk ${pengajuan.mahasiswa.user?.name}. Mohon disahkan.`);
    } else {
      await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Bimbingan Magang Aktif",
        `Dosen pembimbing ${dosen.user?.name} telah menyetujui permohonan bimbingan magang Anda. Bimbingan resmi aktif. Anda sekarang dapat mengajukan konversi SKS.`);
    }

    return res.json({ message: "Permohonan bimbingan berhasil disetujui", data: updated });
  } catch (error) {
    return res.status(500).json({ message: "Gagal menyetujui permohonan", error: error.message });
  }
};

exports.tolakPermohonan = async (req, res) => {
  try {
    const { id } = req.params;
    const { alasanPenolakan } = req.body;

    if (!alasanPenolakan?.trim()) {
      return res.status(400).json({ message: "Alasan penolakan wajib diisi" });
    }

    const dosen = await prisma.dosen.findUnique({ where: { userId: Number(req.user.id) }, include: { user: true } });
    const pengajuan = await prisma.pengajuanDosenPembimbing.findUnique({
      where: { id: Number(id) },
      include: {
        mahasiswa: { include: { user: true } },
        lamaran: { include: { lowongan: { include: { perusahaan: true } } } },
      },
    });
    if (!pengajuan) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    if (pengajuan.dosenDitetapkanId !== dosen.id) return res.status(403).json({ message: "Akses ditolak" });
    if (pengajuan.status !== "MENUNGGU_PERSETUJUAN_DOSEN") {
      return res.status(400).json({ message: "Permohonan ini sudah diproses sebelumnya" });
    }

    const updated = await prisma.pengajuanDosenPembimbing.update({
      where: { id: Number(id) },
      data: {
        status: "DITOLAK_DOSEN",
        alasanPenolakan: alasanPenolakan.trim(),
        dosenDitetapkanId: null,
      },
    });

    // Bimbingan batal -> lepas juga relasi dosenPembimbingId di Lamaran,
    // supaya tidak ada data "nyangkut" dari pengajuan yang sudah ditolak.
    await prisma.lamaran.update({
      where: { id: pengajuan.lamaranId },
      data: { dosenPembimbingId: null },
    });

    await addRiwayat(pengajuan.id, "DITOLAK_DOSEN", `Ditolak oleh dosen. Alasan: ${alasanPenolakan}`, req.user.id, "dosen");

    if (pengajuan.sumberPenetapan === "MAHASISWA") {
      await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Permohonan Bimbingan Ditolak Dosen",
        `Dosen ${dosen.user?.name} menolak permohonan bimbingan. Alasan: ${alasanPenolakan}. Silakan ajukan dosen lain, atau tunggu admin prodi menunjuk dosen pengganti.`);
    } else {
      await kirimNotifikasi(pengajuan.mahasiswa.userId, pengajuan.lamaranId, "Permohonan Bimbingan Ditolak Dosen",
        `Dosen ${dosen.user?.name} menolak penunjukan. Alasan: ${alasanPenolakan}. Admin prodi akan menunjuk dosen pengganti.`);
    }
    await notifikasiAdmin(pengajuan.lamaranId, "Dosen Menolak Permohonan Bimbingan",
      `Dosen ${dosen.user?.name} menolak permohonan bimbingan ${pengajuan.mahasiswa.user?.name}. Alasan: ${alasanPenolakan}. Mohon tunjuk dosen pengganti.`);

    return res.json({ message: "Permohonan berhasil ditolak", data: updated });
  } catch (error) {
    return res.status(500).json({ message: "Gagal menolak permohonan", error: error.message });
  }
};