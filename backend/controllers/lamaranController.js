const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");
const { uploadBufferToCloudinary } = require("../middleware/uploadLamaran");
const { generateSignedPdfUrl } = require("../utils/generateSignedUrl");

exports.getSignedCvUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const lamaran = await prisma.lamaran.findUnique({ where: { id: Number(id) } });
    if (!lamaran || !lamaran.cvFile) {
      return res.status(404).json({ message: "CV tidak ditemukan" });
    }

    // Ambil public_id dari URL Cloudinary yang tersimpan
    // Contoh cvFile: https://res.cloudinary.com/xxx/raw/upload/v.../uploads/lamaran/123-456.pdf
    const publicId = lamaran.cvFile
      .split("/upload/")[1]
      .replace(/^v\d+\//, "")   // buang versi (v1234567/)
      .replace(/\.pdf$/, "");   // buang ekstensi

    const signedUrl = generateSignedPdfUrl(publicId);

    return res.json({ url: signedUrl });
  } catch (error) {
    return res.status(500).json({ message: "Gagal generate signed URL", error: error.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   HELPER — cek apakah mahasiswa sudah punya konfirmasi aktif
════════════════════════════════════════════════════════════════ */
async function getMahasiswaAktifKonfirmasi(mahasiswaId) {
  return prisma.lamaran.findFirst({
    where: {
      mahasiswaId,
      status: "KONFIRMASI_DITERIMA",
    },
  });
}

/* ════════════════════════════════════════════════════════════════
   CREATE LAMARAN
   Guard:
   1. Harus login
   2. Profil mahasiswa harus sudah dibuat (nim, prodi, telepon, dll)
   3. Belum punya KONFIRMASI_DITERIMA di tempat lain
════════════════════════════════════════════════════════════════ */
exports.createLamaran = async (req, res) => {
  try {
    const {
      lowonganId,
      name,
      email,
      phone,
      university,
      major,
      semester,
      portfolio,
      skills,
      motivation,
      startDate,
      duration,
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: "User belum login" });
    }

    if (!lowonganId) {
      return res.status(400).json({ message: "Lowongan ID wajib ada" });
    }

    const lowonganIdNumber = Number(lowonganId);
    if (Number.isNaN(lowonganIdNumber)) {
      return res.status(400).json({ message: "Lowongan ID tidak valid" });
    }

    if (!name || !email || !phone || !university || !motivation || !startDate || !duration) {
      return res.status(400).json({ message: "Data wajib belum lengkap" });
    }

    if (!req.files?.cv?.[0]) {
      return res.status(400).json({ message: "CV wajib diunggah" });
    }

    // ── Guard 1: profil mahasiswa wajib ada ──────────────────────────────────
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });

    if (!mahasiswa) {
      return res.status(403).json({
        code: "PROFILE_INCOMPLETE",
        message:
          "Profil mahasiswa belum dibuat. Silakan lengkapi profil terlebih dahulu sebelum melamar.",
      });
    }

    // ── Guard 2: wajib ada data minimal (nim / prodi / telepon) ──────────────
    const profileLengkap =
      mahasiswa.nim && mahasiswa.prodi && mahasiswa.telepon;

    if (!profileLengkap) {
      return res.status(403).json({
        code: "PROFILE_INCOMPLETE",
        message:
          "Profil mahasiswa belum lengkap (NIM, program studi, dan nomor telepon wajib diisi). Silakan lengkapi profil terlebih dahulu.",
      });
    }

    // ── Guard 3: sudah konfirmasi magang di tempat lain ──────────────────────
    const sudahKonfirmasi = await getMahasiswaAktifKonfirmasi(mahasiswa.id);
    if (sudahKonfirmasi) {
      return res.status(403).json({
        code: "ALREADY_CONFIRMED",
        message:
          "Kamu sudah mengkonfirmasi penerimaan magang di tempat lain. Mahasiswa hanya diperbolehkan magang di satu tempat.",
      });
    }

    // ── Guard 4: sudah pernah melamar lowongan yang sama ─────────────────────
    const sudahMelamar = await prisma.lamaran.findFirst({
      where: { mahasiswaId: mahasiswa.id, lowonganId: lowonganIdNumber },
    });
    if (sudahMelamar) {
      return res.status(400).json({
        code: "ALREADY_APPLIED",
        message: "Kamu sudah pernah melamar lowongan ini.",
      });
    }

    // ── Cek lowongan masih aktif ──────────────────────────────────────────────
    const lowongan = await prisma.lowongan.findUnique({
      where: { id: lowonganIdNumber },
    });

    if (!lowongan) {
      return res.status(404).json({ message: "Lowongan tidak ditemukan" });
    }

    if (lowongan.status !== "Aktif") {
      return res.status(400).json({ message: "Lowongan sudah tidak aktif" });
    }

    if (lowongan.deadline && new Date(lowongan.deadline) < new Date()) {
      return res.status(400).json({ message: "Batas waktu pendaftaran lowongan ini sudah berakhir" });
    }

    let parsedSkills = [];
    try {
      parsedSkills =
        typeof skills === "string" ? JSON.parse(skills) : skills || [];
    } catch {
      parsedSkills = typeof skills === "string" ? [skills] : [];
    }

    // ── Upload berkas ke Cloudinary (SEBELUM simpan ke database) ─────────────
    let cvUrl = null;
    let coverLetterUrl = null;
    let transcriptUrl = null;

    try {
      const cvResult = await uploadBufferToCloudinary(req.files.cv[0].buffer);
      cvUrl = cvResult.secure_url;

      if (req.files.coverLetter?.[0]) {
        const coverResult = await uploadBufferToCloudinary(req.files.coverLetter[0].buffer);
        coverLetterUrl = coverResult.secure_url;
      }

      if (req.files.transcript?.[0]) {
        const transcriptResult = await uploadBufferToCloudinary(req.files.transcript[0].buffer);
        transcriptUrl = transcriptResult.secure_url;
      }
    } catch (uploadError) {
      console.error("CLOUDINARY UPLOAD ERROR:", uploadError.message);
      return res.status(500).json({
        message: "Gagal mengunggah berkas ke Cloudinary",
        error: uploadError.message,
      });
    }

    const lamaran = await prisma.lamaran.create({
      data: {
        mahasiswa:   { connect: { id: mahasiswa.id } },
        lowongan:    { connect: { id: lowonganIdNumber } },
        name,
        email,
        phone,
        university,
        major:       major       || null,
        semester:    semester    || null,
        portfolio:   portfolio   || null,
        skills:      JSON.stringify(parsedSkills),
        motivation,
        cvFile:      cvUrl,
        coverLetter: coverLetterUrl,
        transcript:  transcriptUrl,
        startDate:   new Date(startDate),
        duration,
        status:      "PENDING_BERKAS",
      },
    });

    try {
      await createAuditLog({
        req,
        user: req.user,
        action: "CREATE_LAMARAN",
        description: `${name} mengirim lamaran magang untuk ${lowongan.posisi}`,
        module: "Lamaran",
        status: "BERHASIL",
      });
    } catch (auditError) {
      console.error("AUDIT LOG ERROR:", auditError.message);
    }

    return res.status(201).json({
      message: "Lamaran berhasil dikirim",
      data: lamaran,
    });
  } catch (error) {
    console.error("ERROR CREATE LAMARAN:", error);
    return res.status(500).json({
      message: "Gagal mengirim lamaran",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   GET LAMARAN (admin)
════════════════════════════════════════════════════════════════ */
exports.getLamaran = async (req, res) => {
  try {
    const { search = "", status = "semua", page = 1, limit = 10 } = req.query;

    const where = {
      AND: [
        status !== "semua" ? { status } : {},
        search
          ? {
              OR: [
                { name:       { contains: search } },
                { email:      { contains: search } },
                { university: { contains: search } },
                { major:      { contains: search } },
              ],
            }
          : {},
      ],
    };

    const pageNumber  = Number(page);
    const limitNumber = Number(limit);
    const skip        = (pageNumber - 1) * limitNumber;

    const [data, total, pending, review, approved, rejected, totalAll] =
      await Promise.all([
        prisma.lamaran.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: { createdAt: "desc" },
          include: {
            lowongan:  { include: { perusahaan: true } },
            mahasiswa: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        }),
        prisma.lamaran.count({ where }),
        prisma.lamaran.count({ where: { status: "PENDING_BERKAS" } }),
        prisma.lamaran.count({ where: { status: "BERKAS_DITERIMA" } }),
        prisma.lamaran.count({ where: { status: "DITERIMA_MAGANG" } }),
        prisma.lamaran.count({ where: { status: "DITOLAK" } }),
        prisma.lamaran.count(),
      ]);

    return res.json({
      message: "Data lamaran berhasil diambil",
      data,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      stats: { total: totalAll, pending, review, approved, rejected },
    });
  } catch (error) {
    console.error("ERROR GET LAMARAN:", error);
    return res.status(500).json({
      message: "Gagal mengambil data lamaran",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   GET LAMARAN BY ID
════════════════════════════════════════════════════════════════ */
exports.getLamaranById = async (req, res) => {
  try {
    const { id } = req.params;

    const lamaran = await prisma.lamaran.findUnique({
      where: { id: Number(id) },
      include: {
        lowongan:  { include: { perusahaan: true } },
        mahasiswa: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!lamaran) {
      return res.status(404).json({ message: "Lamaran tidak ditemukan" });
    }

    return res.json({ message: "Detail lamaran berhasil diambil", data: lamaran });
  } catch (error) {
    console.error("ERROR GET LAMARAN BY ID:", error);
    return res.status(500).json({
      message: "Gagal mengambil detail lamaran",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   GET LAMARAN BY MAHASISWA (dengan info sudah konfirmasi / tidak)
════════════════════════════════════════════════════════════════ */
exports.getLamaranByMahasiswa = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User belum login" });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });

    if (!mahasiswa) {
      return res.status(404).json({
        message: "Profil mahasiswa belum dibuat",
        data: [],
        meta: { sudahKonfirmasi: false, profileLengkap: false },
      });
    }

    const profileLengkap = Boolean(
      mahasiswa.nim && mahasiswa.prodi && mahasiswa.telepon
    );

    const lamarans = await prisma.lamaran.findMany({
      where:   { mahasiswaId: mahasiswa.id },
      orderBy: { createdAt: "desc" },
      include: {
        jadwalInterview: true,
        lowongan:        { include: { perusahaan: true } },
        mahasiswa: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    // Apakah sudah ada yang KONFIRMASI_DITERIMA?
    const sudahKonfirmasi = lamarans.some(
      (l) => l.status === "KONFIRMASI_DITERIMA"
    );

    return res.json({
      message: "Data lamaran mahasiswa berhasil diambil",
      data: lamarans,
      meta: { sudahKonfirmasi, profileLengkap },
    });
  } catch (error) {
    console.error("ERROR GET LAMARAN MAHASISWA:", error);
    return res.status(500).json({
      message: "Gagal mengambil data lamaran mahasiswa",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   UPDATE STATUS LAMARAN (admin / perusahaan)
════════════════════════════════════════════════════════════════ */
exports.updateStatusLamaran = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowedStatus = [
      "PENDING_BERKAS",
      "BERKAS_DITERIMA",
      "BERKAS_DITOLAK",
      "INTERVIEW_DIJADWALKAN",
      "LOLOS_INTERVIEW",
      "TIDAK_LOLOS_INTERVIEW",
      "DITERIMA_MAGANG",
      "DITOLAK",
      "KONFIRMASI_DITERIMA",
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const lamaran = await prisma.lamaran.update({
      where: { id: Number(id) },
      data:  { status },
    });

    return res.json({
      message: "Status lamaran berhasil diperbarui",
      data: lamaran,
    });
  } catch (error) {
    console.error("ERROR UPDATE STATUS LAMARAN:", error);
    return res.status(500).json({
      message: "Gagal memperbarui status lamaran",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   KONFIRMASI PENERIMAAN MAGANG
   PATCH /api/lamaran/:id/konfirmasi
   Body: { konfirmasi: true | false, alasanBatal?: string }

   Aturan:
   • konfirmasi = true  → status KONFIRMASI_DITERIMA
     - Lamaran lain milik mahasiswa yang berstatus DITERIMA_MAGANG
       otomatis menjadi DITOLAK (dengan catatan sistem)
     - BARU: otomatis membuat record Magang (periode magang berjalan),
       supaya lamaran ini langsung muncul di halaman
       "Daftar Mahasiswa Magang" milik perusahaan.
   • konfirmasi = false → status DITOLAK, alasanBatal wajib ada
════════════════════════════════════════════════════════════════ */
exports.konfirmasiPenerimaanMagang = async (req, res) => {
  try {
    const { id }                    = req.params;
    const { konfirmasi, alasanBatal } = req.body;

    if (typeof konfirmasi !== "boolean") {
      return res.status(400).json({
        message: "Field 'konfirmasi' harus boolean (true/false)",
      });
    }

    // Jika membatalkan, alasan wajib diisi
    if (konfirmasi === false) {
      const alasan = (alasanBatal || "").trim();
      if (!alasan) {
        return res.status(400).json({
          code: "REASON_REQUIRED",
          message: "Alasan pembatalan wajib diisi.",
        });
      }
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });

    if (!mahasiswa) {
      return res.status(404).json({ message: "Profil mahasiswa tidak ditemukan" });
    }

    const lamaran = await prisma.lamaran.findUnique({
      where: { id: Number(id) },
      include: { lowongan: { include: { perusahaan: true } } },
    });

    if (!lamaran) {
      return res.status(404).json({ message: "Lamaran tidak ditemukan" });
    }

    if (lamaran.mahasiswaId !== mahasiswa.id) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    // Hanya bisa konfirmasi jika status DITERIMA_MAGANG
    if (lamaran.status !== "DITERIMA_MAGANG") {
      return res.status(400).json({
        message: `Konfirmasi hanya bisa dilakukan saat status DITERIMA_MAGANG. Status saat ini: ${lamaran.status}`,
      });
    }

    // Cek: mahasiswa sudah punya konfirmasi lain?
    const sudahKonfirmasiLain = await prisma.lamaran.findFirst({
      where: {
        mahasiswaId: mahasiswa.id,
        status: "KONFIRMASI_DITERIMA",
        id: { not: Number(id) },
      },
    });

    if (konfirmasi && sudahKonfirmasiLain) {
      return res.status(400).json({
        code: "ALREADY_CONFIRMED",
        message:
          "Kamu sudah mengkonfirmasi magang di tempat lain. Mahasiswa hanya boleh magang di satu tempat.",
      });
    }

    let updated;

    if (konfirmasi) {
      // ── Terima: update lamaran ini + tolak otomatis lamaran DITERIMA_MAGANG lainnya ──
      updated = await prisma.lamaran.update({
        where: { id: Number(id) },
        data:  { status: "KONFIRMASI_DITERIMA" },
      });

      // ── BARU — buat record Magang (periode magang berjalan) ────────────────
      // upsert agar idempotent: kalau endpoint ini pernah kepanggil dobel
      // (misal user klik konfirmasi dua kali / race condition), tidak error
      // karena lamaranId bersifat @unique pada model Magang.
      try {
        await prisma.magang.upsert({
          where:  { lamaranId: Number(id) },
          update: {}, // kalau record sudah ada, jangan di-overwrite
          create: {
            lamaranId:    Number(id),
            tanggalMulai: lamaran.startDate, // startDate yang diisi mahasiswa saat melamar
            status:       "Aktif",
          },
        });
      } catch (magangError) {
        // Jangan gagalkan seluruh proses konfirmasi hanya karena ini,
        // tapi catat di log supaya bisa di-backfill manual kalau perlu.
        console.error("GAGAL MEMBUAT RECORD MAGANG:", magangError.message);
      }

      // Otomatis tolak lamaran lain yang juga berstatus DITERIMA_MAGANG
      const lamaranLainDiterima = await prisma.lamaran.findMany({
        where: {
          mahasiswaId: mahasiswa.id,
          status: "DITERIMA_MAGANG",
          id: { not: Number(id) },
        },
        include: { lowongan: { include: { perusahaan: true } } },
      });

      for (const l of lamaranLainDiterima) {
        await prisma.lamaran.update({
          where: { id: l.id },
          data:  { status: "DITOLAK" },
        });

        // Kirim notifikasi pembatalan otomatis
        try {
          await prisma.notifikasi.create({
            data: {
              userId:    req.user.id,
              lamaranId: l.id,
              judul:     "Penerimaan Magang Dibatalkan Otomatis",
              pesan: `Lamaranmu di ${l.lowongan?.perusahaan?.nama ?? "perusahaan"} (${
                l.lowongan?.posisi ?? "posisi"
              }) dibatalkan otomatis karena kamu telah mengkonfirmasi magang di tempat lain.`,
              dibaca: false,
            },
          });
        } catch (e) {
          console.error("NOTIF AUTO-REJECT ERROR:", e.message);
        }
      }

      // Notifikasi konfirmasi berhasil
      try {
        await prisma.notifikasi.create({
          data: {
            userId:    req.user.id,
            lamaranId: Number(id),
            judul:     "Konfirmasi Magang Berhasil",
            pesan: `Kamu telah mengkonfirmasi penerimaan magang di ${
              lamaran.lowongan?.perusahaan?.nama ?? "perusahaan"
            }. Selamat bergabung!`,
            dibaca: false,
          },
        });
      } catch (e) {
        console.error("NOTIFIKASI ERROR:", e.message);
      }
    } else {
      // ── Batalkan: update status + simpan alasan ───────────────────────────
      updated = await prisma.lamaran.update({
        where: { id: Number(id) },
        data:  { status: "DITOLAK" },
      });

      try {
        await prisma.notifikasi.create({
          data: {
            userId:    req.user.id,
            lamaranId: Number(id),
            judul:     "Pendaftaran Magang Dibatalkan",
            pesan: `Kamu telah membatalkan penerimaan magang di ${
              lamaran.lowongan?.perusahaan?.nama ?? "perusahaan"
            }. Alasan: ${(alasanBatal || "").trim()}`,
            dibaca: false,
          },
        });
      } catch (e) {
        console.error("NOTIFIKASI ERROR:", e.message);
      }
    }

    // Audit log
    try {
      await createAuditLog({
        req,
        user: req.user,
        action:      konfirmasi ? "KONFIRMASI_MAGANG" : "BATALKAN_MAGANG",
        description: konfirmasi
          ? `${lamaran.name} mengkonfirmasi penerimaan magang di ${lamaran.lowongan?.perusahaan?.nama}`
          : `${lamaran.name} membatalkan penerimaan magang di ${lamaran.lowongan?.perusahaan?.nama}. Alasan: ${alasanBatal}`,
        module: "Lamaran",
        status: "BERHASIL",
      });
    } catch (e) {
      console.error("AUDIT LOG ERROR:", e.message);
    }

    return res.json({
      message: konfirmasi
        ? "Konfirmasi penerimaan magang berhasil"
        : "Pendaftaran magang berhasil dibatalkan",
      data: updated,
    });
  } catch (error) {
    console.error("ERROR KONFIRMASI MAGANG:", error);
    return res.status(500).json({
      message: "Gagal memproses konfirmasi",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   DELETE LAMARAN
════════════════════════════════════════════════════════════════ */
exports.deleteLamaran = async (req, res) => {
  try {
    const { id } = req.params;

    const lamaran = await prisma.lamaran.findUnique({
      where: { id: Number(id) },
    });

    if (!lamaran) {
      return res.status(404).json({ message: "Lamaran tidak ditemukan" });
    }

    // Tidak bisa hapus lamaran yang sudah KONFIRMASI_DITERIMA
    if (lamaran.status === "KONFIRMASI_DITERIMA") {
      return res.status(400).json({
        code: "CANNOT_DELETE_CONFIRMED",
        message:
          "Lamaran yang sudah dikonfirmasi tidak dapat dihapus. Hubungi admin jika ada permasalahan.",
      });
    }

    await prisma.lamaran.delete({ where: { id: Number(id) } });

    try {
      await createAuditLog({
        req,
        user: req.user,
        action:      "DELETE_LAMARAN",
        description: `Lamaran dari ${lamaran.name} berhasil dihapus`,
        module:      "Lamaran",
        status:      "BERHASIL",
      });
    } catch (e) {
      console.error("AUDIT LOG ERROR:", e.message);
    }

    return res.json({ message: "Lamaran berhasil dihapus" });
  } catch (error) {
    console.error("ERROR DELETE LAMARAN:", error);
    return res.status(500).json({
      message: "Gagal menghapus lamaran",
      error: error.message,
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   CEK STATUS PROFILE & KONFIRMASI
   GET /api/lamaran/cek-eligibilitas
   Dipakai frontend sebelum menampilkan tombol "Lamar"
════════════════════════════════════════════════════════════════ */
exports.cekEligibilitas = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.json({ bolehMelamar: false, alasan: "BELUM_LOGIN" });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: Number(req.user.id) },
    });

    if (!mahasiswa) {
      return res.json({ bolehMelamar: false, alasan: "PROFIL_BELUM_DIBUAT" });
    }

    const profileLengkap = Boolean(
      mahasiswa.nim && mahasiswa.prodi && mahasiswa.telepon
    );

    if (!profileLengkap) {
      return res.json({
        bolehMelamar: false,
        alasan: "PROFIL_TIDAK_LENGKAP",
        detail: "NIM, program studi, dan nomor telepon wajib diisi.",
      });
    }

    const sudahKonfirmasi = await getMahasiswaAktifKonfirmasi(mahasiswa.id);
    if (sudahKonfirmasi) {
      return res.json({
        bolehMelamar: false,
        alasan: "SUDAH_KONFIRMASI",
        detail: "Kamu sudah mengkonfirmasi magang di tempat lain.",
      });
    }

    return res.json({ bolehMelamar: true });
  } catch (error) {
    return res.status(500).json({ message: "Gagal cek eligibilitas", error: error.message });
  }
};