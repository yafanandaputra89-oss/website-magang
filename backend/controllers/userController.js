const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const createAuditLog = require("../utils/auditLog");

const allowedRoles = ["mahasiswa", "dosen", "admin", "perusahaan"];
const allowedStatus = ["Aktif", "Magang", "Pending", "Nonaktif"];

exports.getUsers = async(req, res) => {
    try {
        const { search = "", role = "Semua", page = 1, limit = 8 } = req.query;

        const where = {
            AND: [
                role && role !== "Semua" ? { role: role.toLowerCase() } : {},
                search ? {
                    OR: [
                        { name: { contains: search } },
                        { username: { contains: search } },
                        { email: { contains: search } },
                    ],
                } : {},
            ],
        };

        const skip = (Number(page) - 1) * Number(limit);

        const [users, total, mahasiswa, dosen, admin, perusahaan] =
        await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    role: true,
                    status: true,
                    lastLogin: true,
                    createdAt: true,
                },
            }),
            prisma.user.count({ where }),
            prisma.user.count({ where: { role: "mahasiswa" } }),
            prisma.user.count({ where: { role: "dosen" } }),
            prisma.user.count({ where: { role: "admin" } }),
            prisma.user.count({ where: { role: "perusahaan" } }),
        ]);

        res.json({
            message: "Data user berhasil diambil",
            data: users,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
            stats: {
                total: await prisma.user.count(),
                mahasiswa,
                dosen,
                admin,
                perusahaan,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil data user",
            error: error.message,
        });
    }
};

exports.createUser = async(req, res) => {
    try {
        const { name, username, email, password, role, status } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: "Nama, email, password, dan role wajib diisi",
            });
        }

        const selectedRole = role.toLowerCase();

        if (!allowedRoles.includes(selectedRole)) {
            return res.status(400).json({ message: "Role tidak valid" });
        }

        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({ message: "Status tidak valid" });
        }

        const existingEmail = await prisma.user.findUnique({
            where: { email },
        });

        if (existingEmail) {
            return res.status(409).json({ message: "Email sudah digunakan" });
        }

        if (username) {
            const existingUsername = await prisma.user.findUnique({
                where: { username },
            });

            if (existingUsername) {
                return res.status(409).json({ message: "Username sudah digunakan" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                username,
                email,
                password: hashedPassword,
                role: selectedRole,
                status: status || "Aktif",
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });

        await createAuditLog({
            req,
            user: req.user,
            action: "CREATE_USER",
            description: `Admin menambahkan user baru: ${name}`,
            module: "Manajemen User",
            status: "BERHASIL",
        });

        res.status(201).json({
            message: "User berhasil ditambahkan",
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal menambahkan user",
            error: error.message,
        });
    }
};

exports.updateUser = async(req, res) => {
    try {
        const { id } = req.params;
        const { name, username, email, role, status, password } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { id: Number(id) },
        });

        if (!existingUser) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        const data = {};

        if (name) data.name = name;
        if (username) data.username = username;
        if (email) data.email = email;
        if (status) data.status = status;

        if (role) {
            const selectedRole = role.toLowerCase();

            if (!allowedRoles.includes(selectedRole)) {
                return res.status(400).json({ message: "Role tidak valid" });
            }

            data.role = selectedRole;
        }

        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data,
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                status: true,
                lastLogin: true,
                createdAt: true,
            },
        });

        await createAuditLog({
            req,
            user: req.user,
            action: "UPDATE_USER",
            description: `Admin mengubah data user: ${updatedUser.name}`,
            module: "Manajemen User",
            status: "BERHASIL",
        });

        res.json({
            message: "User berhasil diperbarui",
            data: updatedUser,
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal memperbarui user",
            error: error.message,
        });
    }
};

exports.deleteUser = async(req, res) => {
    try {
        const { id } = req.params;

        const existingUser = await prisma.user.findUnique({
            where: { id: Number(id) },
        });

        if (!existingUser) {
            return res.status(404).json({ message: "User tidak ditemukan" });
        }

        await prisma.user.delete({
            where: { id: Number(id) },
        });

        await createAuditLog({
            req,
            user: req.user,
            action: "DELETE_USER",
            description: `Admin menghapus user: ${existingUser.name}`,
            module: "Manajemen User",
            status: "BERHASIL",
        });

        res.json({
            message: "User berhasil dihapus",
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal menghapus user",
            error: error.message,
        });
    }
};