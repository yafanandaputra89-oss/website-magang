const express = require("express");
const router = express.Router();

const lamaranController = require("../controllers/lamaranController");
const { verifyToken } = require("../middleware/authMiddleware");
const { uploadLamaran } = require("../middleware/uploadLamaran");

// GET semua lamaran milik mahasiswa yang login
router.get(
    "/mahasiswa",
    verifyToken,
    lamaranController.getLamaranByMahasiswa
);

// POST buat lamaran baru
router.post(
    "/",
    verifyToken,
    uploadLamaran,
    lamaranController.createLamaran
);

// GET semua lamaran (admin / perusahaan)
router.get(
    "/",
    verifyToken,
    lamaranController.getLamaran
);

// GET detail lamaran by ID
// GET signed URL untuk lihat/download CV
router.get(
    "/:id/cv-url",
    verifyToken,
    lamaranController.getSignedCvUrl
);

// PATCH update status lamaran (oleh admin / perusahaan)
router.patch(
    "/:id/status",
    verifyToken,
    lamaranController.updateStatusLamaran
);

// PATCH konfirmasi penerimaan magang (oleh mahasiswa)
// Body: { konfirmasi: true }  → status jadi KONFIRMASI_DITERIMA
// Body: { konfirmasi: false } → status jadi DITOLAK (batalkan sendiri)
router.patch(
    "/:id/konfirmasi",
    verifyToken,
    lamaranController.konfirmasiPenerimaanMagang
);

// DELETE hapus / batalkan lamaran
router.delete(
    "/:id",
    verifyToken,
    lamaranController.deleteLamaran
);

module.exports = router;