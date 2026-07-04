const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");


exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Nama, email, dan password wajib diisi",
            });
        }

        const selectedRole = role || "mahasiswa";
        const allowedRoles = ["mahasiswa", "dosen", "admin", "perusahaan"];

        if (!allowedRoles.includes(selectedRole)) {
            return res.status(400).json({ message: "Role tidak valid" });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            return res.status(409).json({ message: "Email sudah terdaftar" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: selectedRole,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        if (selectedRole === "mahasiswa") {
            await prisma.mahasiswa.create({
                data: {
                    userId: user.id,
                    name: name,
                },
            });
        }

        // ✅ Buat token langsung setelah register
        //    sehingga frontend tidak perlu login ulang
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(201).json({
            message: "Register berhasil",
            token,                   // ← wajib ada agar redirect ke dashboard langsung
            user: {
                id:    user.id,
                name:  user.name,
                email: user.email,
                role:  user.role,
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Terjadi kesalahan server",
            error: error.message,
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email dan password wajib diisi" });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            await createAuditLog({
                req,
                user: { id: null, name: email, role: null },
                action: "LOGIN",
                description: `Login gagal - akun tidak ditemukan: ${email}`,
                module: "Auth",
                status: "GAGAL",
            });
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            await createAuditLog({
                req,
                user,
                action: "LOGIN",
                description: `Login gagal - password salah untuk akun: ${email}`,
                module: "Auth",
                status: "GAGAL",
            });
            return res.status(401).json({ message: "Password salah" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        await createAuditLog({
            req,
            user,
            action: "LOGIN",
            description: `${user.name} berhasil masuk ke sistem`,
            module: "Auth",
            status: "BERHASIL",
        });

        return res.status(200).json({
            message: "Login berhasil",
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Terjadi kesalahan server",
            error: error.message,
        });
    }
};

exports.getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        return res.json({
            message: "Data user berhasil diambil",
            data: user,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil data user",
            error: error.message,
        });
    }
};

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

        const nip = profile.nip && profile.nip.trim() !== "" ? profile.nip.trim() : null;
        const nidn = profile.nidn && profile.nidn.trim() !== "" ? profile.nidn.trim() : null;

        if (nip) {
            const dupNip = await prisma.dosen.findFirst({
                where: { nip, NOT: { userId } },
            });
            if (dupNip) {
                return res.status(409).json({
                    message: "NIP sudah digunakan oleh dosen lain. Periksa kembali isian NIP Anda.",
                });
            }
        }

        if (nidn) {
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
            where: { userId },
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
                item.status === "DITERIMA_MAGANG" ? 100 :
                item.status === "LOLOS_INTERVIEW" ? 80 :
                item.status === "INTERVIEW_DIJADWALKAN" ? 60 :
                item.status === "BERKAS_DITERIMA" ? 40 :
                item.status === "PENDING_BERKAS" ? 20 : 0,
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

// ── registerPerusahaan — mengembalikan token + user agar bisa langsung login ──

exports.registerPerusahaan = async (req, res) => {
    try {
        const { name, email, password, perusahaan } = req.body;

        if (!name || !email || !password || !perusahaan?.nama) {
            return res.status(400).json({
                message: "Nama perusahaan, penanggung jawab, email, dan password wajib diisi",
            });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            return res.status(409).json({ message: "Email sudah terdaftar" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "perusahaan",
                perusahaan: {
                    create: {
                        nama: perusahaan.nama,
                        bidang: perusahaan.bidang || null,
                        alamat: perusahaan.alamat || null,
                        telepon: perusahaan.telepon || null,
                        ukuran: perusahaan.ukuran || null,
                        website: perusahaan.website || null,
                        namaCP: perusahaan.namaCP || name,
                        jabatanCP: perusahaan.jabatanCP || null,
                        deskripsiSingkat: perusahaan.deskripsiSingkat || null,
                        logo: perusahaan.logo || null,
                        tahunBerdiri: perusahaan.tahunBerdiri || null,
                        linkedin: perusahaan.linkedin || null,
                        instagram: perusahaan.instagram || null,
                        deskripsi: perusahaan.deskripsi || null,
                        kultur: perusahaan.kultur || null,
                        nilaiKultur: perusahaan.nilaiKultur
                            ? JSON.stringify(perusahaan.nilaiKultur)
                            : null,
                        statusVerifikasi: "MENUNGGU",
                    },
                },
            },
            include: { perusahaan: true },
        });

        // ── Buat token langsung agar frontend bisa redirect ke dashboard ──
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        await createAuditLog({
            req,
            user,
            action: "REGISTER",
            description: `Perusahaan ${perusahaan.nama} berhasil terdaftar oleh ${name} (${email})`,
            module: "Auth",
            status: "BERHASIL",
        });

        return res.status(201).json({
            message: "Register perusahaan berhasil. Akun menunggu verifikasi admin.",
            // ── token & user dikembalikan agar useAuth di frontend bisa langsung jalan ──
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Register perusahaan error:", error);

        if (error.code === "P2002") {
            const field = error.meta?.target?.[0] || "data";
            return res.status(409).json({
                message: `${field} sudah terdaftar. Gunakan ${field} yang berbeda.`,
            });
        }

        return res.status(500).json({
            message: "Terjadi kesalahan server",
            error: error.message,
        });
    }
};