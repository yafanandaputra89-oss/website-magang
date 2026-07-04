const prisma = require("../config/prisma");

exports.getAuditLogs = async(req, res) => {
    try {
        const { search, module, status, page = 1, limit = 10 } = req.query;

        const where = {
            AND: [
                module && module !== "Semua Modul" ? { module } : {},
                status && status !== "Semua Status" ? { status } : {},
                search ? {
                    OR: [
                        { userName: { contains: search } },
                        { action: { contains: search } },
                        { description: { contains: search } },
                        { module: { contains: search } },
                        { ipAddress: { contains: search } },
                    ],
                } : {},
            ],
        };

        const skip = (Number(page) - 1) * Number(limit);

        const [logs, total, berhasil, gagal, today] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: Number(limit),
            }),

            prisma.auditLog.count({ where }),

            prisma.auditLog.count({
                where: {
                    status: "BERHASIL",
                },
            }),

            prisma.auditLog.count({
                where: {
                    status: "GAGAL",
                },
            }),

            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
        ]);

        res.json({
            message: "Audit log berhasil diambil",
            data: logs,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
            stats: {
                total: await prisma.auditLog.count(),
                berhasil,
                gagal,
                today,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: "Gagal mengambil audit log",
            error: error.message,
        });
    }
};