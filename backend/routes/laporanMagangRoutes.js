const express = require("express");
const router = express.Router();

const {
    uploadLaporanMagang,
    getInfoAktifMahasiswa,
    getLaporanMahasiswa,
    getLaporanDosen,
    reviewLaporanDosen,
} = require("../controllers/laporanMagangController");

// PENTING: uploadLaporan.js sekarang mengekspor sebuah objek
// { uploadLaporan, uploadLaporanBufferToCloudinary }, jadi harus di-destructure.
const { uploadLaporan } = require("../middleware/uploadLaporan");
const { verifyToken, checkRole } = require("../middleware/authMiddleware");

/* ── Mahasiswa ────────────────────────────────────────────────── */

// Ambil info lamaran aktif (lamaranId + info dosen) — untuk prefill form
router.get(
    "/info-aktif",
    verifyToken,
    checkRole("mahasiswa"),
    getInfoAktifMahasiswa
);

// Upload laporan baru
router.post(
    "/upload",
    verifyToken,
    checkRole("mahasiswa"),
    uploadLaporan.single("file"),
    uploadLaporanMagang
);

// Riwayat laporan milik mahasiswa
router.get(
    "/mahasiswa",
    verifyToken,
    checkRole("mahasiswa"),
    getLaporanMahasiswa
);

/* ── Dosen ────────────────────────────────────────────────────── */

// Semua laporan mahasiswa bimbingan (dikelompokkan)
router.get(
    "/dosen",
    verifyToken,
    checkRole("dosen"),
    getLaporanDosen
);

// Beri nilai laporan
router.patch(
    "/dosen/:laporanId/review",
    verifyToken,
    checkRole("dosen"),
    reviewLaporanDosen
);

module.exports = router;