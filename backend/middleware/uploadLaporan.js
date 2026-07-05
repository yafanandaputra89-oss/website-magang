const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Simpan file sementara di memory (RAM), bukan disk
const storage = multer.memoryStorage();

// Izinkan tipe yang sama dengan frontend
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

// Mapping mimetype -> ekstensi (dipakai untuk public_id/format di Cloudinary)
const MIME_EXT_MAP = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/jpg": "jpg",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

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

/**
 * Upload buffer file laporan ke Cloudinary.
 * - Gambar (jpg/png) disimpan sebagai resource_type "image"
 * - PDF/Word/Excel disimpan sebagai resource_type "raw" (agar bisa diakses langsung / signed url)
 *
 * @param {Buffer} buffer   - file.buffer dari multer memoryStorage
 * @param {string} mimetype - file.mimetype dari multer
 * @param {string} folderName
 * @returns {Promise<object>} hasil upload Cloudinary (termasuk secure_url)
 */
const uploadLaporanBufferToCloudinary = (
    buffer,
    mimetype,
    folderName = "uploads/laporan"
) => {
    return new Promise((resolve, reject) => {
        const ext = MIME_EXT_MAP[mimetype] || "bin";
        const isImage = mimetype.startsWith("image/");
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);

        const stream = cloudinary.uploader.upload_stream({
                folder: folderName,
                resource_type: isImage ? "image" : "raw",
                public_id: uniqueName,
                // format hanya perlu di-set untuk non-image (raw) supaya ekstensi ikut tersimpan
                ...(isImage ? {} : { format: ext }),
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};

module.exports = { uploadLaporan, uploadLaporanBufferToCloudinary };