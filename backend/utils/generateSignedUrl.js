const cloudinary = require("../config/cloudinary");

/**
 * Generate signed URL (time-limited) untuk akses file PDF original,
 * dipakai selagi akun Cloudinary masih kena flag "untrusted".
 *
 * @param {string} publicId - public_id file di Cloudinary (termasuk folder, tanpa extension)
 * @returns {string} signed URL yang bisa diakses langsung
 */
function generateSignedPdfUrl(publicId) {
    return cloudinary.utils.private_download_url(publicId, "pdf", {
        resource_type: "raw",
        type: "upload",
    });
}

module.exports = { generateSignedPdfUrl };