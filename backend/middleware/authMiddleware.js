const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Token tidak ditemukan",
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Format token salah",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token tidak valid",
        });
    }
};

exports.checkRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Akses ditolak",
            });
        }

        next();
    };
};