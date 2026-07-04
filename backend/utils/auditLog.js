const prisma = require("../config/prisma");

const createAuditLog = async ({
  req,
  user,
  action,
  description,
  module,
  status = "BERHASIL",
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id || req.user?.id || null,
        userName: user?.name || req.user?.name || null,
        role: user?.role || req.user?.role || null,
        action,
        description,
        module,
        status,
        ipAddress:
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          req.ip,
      },
    });
  } catch (error) {
    console.log("Gagal membuat audit log:", error.message);
  }
};

module.exports = createAuditLog;