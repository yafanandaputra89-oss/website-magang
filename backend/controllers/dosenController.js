const prisma = require("../config/prisma");

exports.getProfileDosen = async (req, res) => {
  try {
    const userId = req.user.id;

    const dosen = await prisma.dosen.findUnique({
      where: { userId },
      include: {
        educations: true,
        courses: true,
        expertises: true,
        certs: true,
      },
    });

    if (!dosen) {
      return res.status(404).json({
        message: "Profil dosen belum dibuat",
        data: null,
      });
    }

    res.json({
      message: "Profil dosen berhasil diambil",
      data: dosen,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil profil dosen",
      error: error.message,
    });
  }
};

exports.createOrUpdateProfileDosen = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      profile = {},
      education = [],
      courses = [],
      expertise = [],
      certs = [],
      avatar = null,
    } = req.body;

    // ── Normalisasi NIP/NIDN: string kosong dianggap null ───────────
    const nip = profile.nip && profile.nip.trim() !== "" ? profile.nip.trim() : null;
    const nidn = profile.nidn && profile.nidn.trim() !== "" ? profile.nidn.trim() : null;

    // ── Ambil data dosen yang sudah ada (kalau ada), dipakai untuk
    //    mengecualikan record milik dosen ini sendiri saat cek duplikat.
    const existingDosen = await prisma.dosen.findUnique({ where: { userId } });

    // ── Cek duplikat NIP sebelum upsert (mencegah 500 generic) ──────
    // NIP/NIDN boleh diubah kapan pun oleh dosen; yang tidak boleh
    // hanya memakai nomor yang sudah dipakai dosen lain.
    if (nip && nip !== existingDosen?.nip) {
      const dupNip = await prisma.dosen.findFirst({
        where: { nip, NOT: { userId } },
      });
      if (dupNip) {
        return res.status(409).json({
          message: "NIP sudah digunakan oleh dosen lain. Periksa kembali isian NIP Anda.",
        });
      }
    }

    // ── Cek duplikat NIDN sebelum upsert ─────────────────────────────
    if (nidn && nidn !== existingDosen?.nidn) {
      const dupNidn = await prisma.dosen.findFirst({
        where: { nidn, NOT: { userId } },
      });
      if (dupNidn) {
        return res.status(409).json({
          message: "NIDN sudah digunakan oleh dosen lain. Periksa kembali isian NIDN Anda.",
        });
      }
    }

    const dosen = await prisma.dosen.upsert({
      where: { userId },
      update: {
        name: profile.name || null,
        nip,
        nidn,
        position: profile.position || null,
        rank: profile.rank || null,
        department: profile.department || null,
        faculty: profile.faculty || null,
        email: profile.email || null,
        phone: profile.phone || null,
        office: profile.office || null,
        bio: profile.bio || null,
        avatar,
      },
      create: {
        userId,
        name: profile.name || null,
        nip,
        nidn,
        position: profile.position || null,
        rank: profile.rank || null,
        department: profile.department || null,
        faculty: profile.faculty || null,
        email: profile.email || null,
        phone: profile.phone || null,
        office: profile.office || null,
        bio: profile.bio || null,
        avatar,
      },
    });

    await prisma.dosenEducation.deleteMany({ where: { dosenId: dosen.id } });
    await prisma.dosenCourse.deleteMany({ where: { dosenId: dosen.id } });
    await prisma.dosenExpertise.deleteMany({ where: { dosenId: dosen.id } });
    await prisma.dosenCertification.deleteMany({ where: { dosenId: dosen.id } });

    if (education.length > 0) {
      await prisma.dosenEducation.createMany({
        data: education.map((item) => ({
          dosenId: dosen.id,
          degree: item.degree || "",
          school: item.school || "",
          year: item.year || "",
        })),
      });
    }

    if (courses.length > 0) {
      await prisma.dosenCourse.createMany({
        data: courses.map((item) => ({
          dosenId: dosen.id,
          course: item.course || "",
          level: item.level || "",
          semester: item.semester || "",
        })),
      });
    }

    if (expertise.length > 0) {
      await prisma.dosenExpertise.createMany({
        data: expertise.map((item) => ({
          dosenId: dosen.id,
          tag: item.tag || "",
        })),
      });
    }

    if (certs.length > 0) {
      await prisma.dosenCertification.createMany({
        data: certs.map((item) => ({
          dosenId: dosen.id,
          title: item.title || "",
          issuer: item.issuer || "",
          year: item.year || "",
        })),
      });
    }

    const updatedProfile = await prisma.dosen.findUnique({
      where: { userId },
      include: {
        educations: true,
        courses: true,
        expertises: true,
        certs: true,
      },
    });

    return res.json({
      message: "Profil dosen berhasil disimpan",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Error createOrUpdateProfileDosen:", error);

    // ── Fallback kalau tetap kena unique constraint (race condition) ──
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "data";
      return res.status(409).json({
        message: `${String(field).toUpperCase()} yang Anda masukkan sudah digunakan dosen lain.`,
      });
    }

    return res.status(500).json({
      message: "Gagal menyimpan profil dosen",
      error: error.message,
    });
  }
};

exports.getAllDosen = async (req, res) => {
  try {
    const data = await prisma.dosen.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json({
      message: "Data dosen berhasil diambil",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Gagal mengambil data dosen",
      error: error.message,
    });
  }
};

exports.getMahasiswaBimbingan = async (req, res) => {
  try {
    const userId = req.user.id;

    const dosen = await prisma.dosen.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!dosen) {
      return res.status(404).json({
        message: "Data dosen tidak ditemukan. Silakan lengkapi profil dosen terlebih dahulu.",
        data: [],
      });
    }

    const data = await prisma.lamaran.findMany({
      where: {
        dosenPembimbingId: dosen.id,
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

    const result = data.map((item) => ({
      id: item.id,
      nama: item.mahasiswa?.user?.name || item.name || "-",
      nim: item.mahasiswa?.nim || "-",
      email: item.mahasiswa?.user?.email || item.email || "-",
      perusahaan: item.lowongan?.perusahaan?.nama || "-",
      posisi: item.lowongan?.posisi || "-",
      status: item.status,
      progress:
        item.status === "DITERIMA_MAGANG"
          ? 100
          : item.status === "LOLOS_INTERVIEW"
          ? 80
          : item.status === "INTERVIEW_DIJADWALKAN"
          ? 60
          : item.status === "BERKAS_DITERIMA"
          ? 40
          : item.status === "PENDING_BERKAS"
          ? 20
          : 0,
    }));

    return res.json(result);
  } catch (error) {
    console.error("Error getMahasiswaBimbingan:", error);

    return res.status(500).json({
      message: "Gagal mengambil mahasiswa bimbingan",
      error: error.message,
    });
  }
};