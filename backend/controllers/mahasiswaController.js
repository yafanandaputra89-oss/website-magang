const prisma = require("../config/prisma");

// ── Include helper ─────────────────────────────────────────────────────────────
const mahasiswaInclude = {
  user: {
    select: { id: true, name: true, email: true, role: true },
  },
  skills: true,
  pendidikans: true,
  pengalamans: true,
  sosialMedia: true,
};

// ── GET Profil ─────────────────────────────────────────────────────────────────
exports.getProfileMahasiswa = async (req, res) => {
  try {
    const userId = req.user.id;

    let mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId },
      include: mahasiswaInclude,
    });

    // Kalau belum ada, buat otomatis dari data user
    if (!mahasiswa) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      mahasiswa = await prisma.mahasiswa.create({
        data: {
          userId,
          name: user?.name || "", // ← pakai "name" sesuai schema
        },
        include: mahasiswaInclude,
      });
    }

    // Normalisasi response: tambahkan field "nama" agar frontend tetap bisa pakai nama
    const data = {
      ...mahasiswa,
      nama: mahasiswa.name, // alias agar frontend tidak perlu ganti
    };

    res.json({
      message: "Profil mahasiswa berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("❌ getProfileMahasiswa error:", error);
    res.status(500).json({
      message: "Gagal mengambil profil mahasiswa",
      error: error.message,
    });
  }
};

// ── CREATE / UPDATE Profil ─────────────────────────────────────────────────────
exports.createOrUpdateProfileMahasiswa = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      nama,        // frontend kirim "nama", kita map ke "name"
      nim,
      prodi,
      angkatan,
      semester,
      ipk,
      totalSks,
      alamat,
      telepon,
      fotoProfil,
      about,
      skills,
      pendidikans,
      pengalamans,
      sosialMedia,
      // dosenPembimbing sengaja tidak diambil — hanya admin yang bisa set
    } = req.body;

    // ── Upsert data utama mahasiswa ───────────────────────────────────────────
    const mahasiswa = await prisma.mahasiswa.upsert({
      where: { userId },
      update: {
        name: nama,          // ← schema pakai "name"
        nim,
        prodi,
        angkatan,
        semester: semester !== undefined && semester !== "" ? Number(semester) : null,
        ipk: ipk !== undefined && ipk !== "" ? parseFloat(ipk) : null,
        totalSks: totalSks !== undefined && totalSks !== "" ? Number(totalSks) : null,
        alamat,
        telepon,
        fotoProfil,
        about,
        // dosenPembimbingId TIDAK diupdate di sini — hanya admin
      },
      create: {
        userId,
        name: nama,          // ← schema pakai "name"
        nim,
        prodi,
        angkatan,
        semester: semester !== undefined && semester !== "" ? Number(semester) : null,
        ipk: ipk !== undefined && ipk !== "" ? parseFloat(ipk) : null,
        totalSks: totalSks !== undefined && totalSks !== "" ? Number(totalSks) : null,
        alamat,
        telepon,
        fotoProfil,
        about,
      },
    });

    // ── Skills: hapus lama, buat baru ─────────────────────────────────────────
    if (Array.isArray(skills)) {
      await prisma.skill.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
      if (skills.length > 0) {
        await prisma.skill.createMany({
          data: skills.map((skill) => ({
            mahasiswaId: mahasiswa.id,
            name: skill.name,
          })),
        });
      }
    }

    // ── Pendidikan: hapus lama, buat baru ─────────────────────────────────────
    if (Array.isArray(pendidikans)) {
      await prisma.pendidikan.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
      if (pendidikans.length > 0) {
        await prisma.pendidikan.createMany({
          data: pendidikans.map((item) => ({
            mahasiswaId: mahasiswa.id,
            school: item.school,
            degree: item.degree,
            startYear: item.startYear || item.start || "",
            endYear: item.endYear || item.end || "",
            description: item.description || item.desc || null,
          })),
        });
      }
    }

    // ── Pengalaman: hapus lama, buat baru ─────────────────────────────────────
    if (Array.isArray(pengalamans)) {
      await prisma.pengalaman.deleteMany({ where: { mahasiswaId: mahasiswa.id } });
      if (pengalamans.length > 0) {
        await prisma.pengalaman.createMany({
          data: pengalamans.map((item) => ({
            mahasiswaId: mahasiswa.id,
            role: item.role,
            company: item.company,
            type: item.type || null,
            startDate: item.startDate || item.start || "",
            endDate: item.endDate || item.end || null,
            location: item.location || null,
            description: item.description || item.desc || null,
          })),
        });
      }
    }

    // ── Sosial Media: upsert ──────────────────────────────────────────────────
    if (sosialMedia) {
      await prisma.sosialMedia.upsert({
        where: { mahasiswaId: mahasiswa.id },
        update: {
          instagram: sosialMedia.instagram || null,
          twitter: sosialMedia.twitter || null,
          github: sosialMedia.github || null,
          website: sosialMedia.website || null,
        },
        create: {
          mahasiswaId: mahasiswa.id,
          instagram: sosialMedia.instagram || null,
          twitter: sosialMedia.twitter || null,
          github: sosialMedia.github || null,
          website: sosialMedia.website || null,
        },
      });
    }

    // ── Return profil terbaru ─────────────────────────────────────────────────
    const updatedProfile = await prisma.mahasiswa.findUnique({
      where: { userId },
      include: mahasiswaInclude,
    });

    res.json({
      message: "Profil mahasiswa berhasil disimpan",
      data: {
        ...updatedProfile,
        nama: updatedProfile.name, // alias untuk frontend
      },
    });
  } catch (error) {
    console.error("❌ createOrUpdateProfileMahasiswa error:", error);
    res.status(500).json({
      message: "Gagal menyimpan profil mahasiswa",
      error: error.message,
    });
  }
};

// ── [ADMIN] Set Dosen Pembimbing ──────────────────────────────────────────────
// Route: PUT /api/admin/mahasiswa/:mahasiswaId/dosen-pembimbing
// Middleware: requireRole("admin")
exports.setDosenPembimbing = async (req, res) => {
  try {
    const { mahasiswaId } = req.params;
    const { dosenPembimbingId } = req.body;

    if (!dosenPembimbingId) {
      return res.status(400).json({ message: "dosenPembimbingId wajib diisi" });
    }

    // dosenPembimbing ada di model Lamaran, bukan Mahasiswa
    // Update semua lamaran aktif mahasiswa ini
    const updated = await prisma.lamaran.updateMany({
      where: {
        mahasiswaId: Number(mahasiswaId),
        status: { notIn: ["DITOLAK"] },
      },
      data: { dosenPembimbingId: Number(dosenPembimbingId) },
    });

    res.json({
      message: "Dosen pembimbing berhasil ditetapkan",
      data: updated,
    });
  } catch (error) {
    console.error("❌ setDosenPembimbing error:", error);
    res.status(500).json({
      message: "Gagal menetapkan dosen pembimbing",
      error: error.message,
    });
  }
};