const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Buat folder otomatis kalau belum ada
const uploadDir = path.join(__dirname, "../uploads/laporan");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    },
});

// Izinkan semua tipe yang sama dengan frontend
const ALLOWED_MIMETYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(new Error("Tipe file tidak didukung"), false);
    }
    cb(null, true);
};

const uploadLaporan = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB (sama dengan frontend)
    },
});

module.exports = uploadLaporan;