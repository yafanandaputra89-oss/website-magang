const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Simpan file sementara di memory (RAM), bukan disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
        return cb(new Error("File harus berformat PDF"), false);
    }
    cb(null, true);
};

// Terima 3 field sekaligus: cv (wajib), coverLetter (opsional), transcript (opsional)
const uploadLamaran = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
    { name: "cv", maxCount: 1 },
    { name: "coverLetter", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
]);

// Upload satu buffer ke Cloudinary, kembalikan secure_url
const uploadBufferToCloudinary = (buffer, folderName = "uploads/lamaran") => {
    return new Promise((resolve, reject) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);

        const stream = cloudinary.uploader.upload_stream({
                folder: folderName,
                resource_type: "raw",
                public_id: uniqueName,
                format: "pdf",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};

module.exports = { uploadLamaran, uploadBufferToCloudinary };