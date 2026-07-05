const express = require("express");
const cors = require("cors");
require("dotenv").config();

console.log("JWT_SECRET status:", process.env.JWT_SECRET ? "✅ termuat" : "❌ KOSONG");
if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET tidak ditemukan di .env — server dihentikan.");
    process.exit(1);
}

const authRoutes = require("./routes/authRoutes");
const mahasiswaRoutes = require("./routes/mahasiswaRoutes");
const perusahaanRoutes = require("./routes/perusahaanRoutes");
const lowonganRoutes = require("./routes/lowonganRoutes");
const dosenRoutes = require("./routes/dosenRoutes");
const perusahaanProfileRoutes = require("./routes/perusahaanProfileRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const userRoutes = require("./routes/userRoutes");
const lamaranRoutes = require("./routes/lamaranRoutes");
const konversiSksRoutes = require("./routes/konversiSksRoutes");
const persetujuanKonversiRoutes = require("./routes/persetujuanKonversiRoutes");
const verifikasiPerusahaanRoutes = require("./routes/verifikasiPerusahaanRoutes");
const laporanMagangRoutes = require("./routes/laporanMagangRoutes");
const pengajuanDosenRoutes = require("./routes/Pengajuandosenroutes"); // ← disesuaikan dengan nama file asli
const adminLowonganRoutes = require("./routes/adminLowonganRoutes");
const magangRoutes = require("./routes/MagangRoutes"); // ← disesuaikan dengan nama file asli
const persetujuanKonversiAdminRoutes = require("./routes/Persetujuankonversiadminroutes");
const rekrutmenRoutes = require("./routes/rekrutmenRoutes");
const notifikasiRoutes = require("./routes/notifikasiRoutes");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "https://sistem-informasi-pemagangan-mahasis-eta.vercel.app",
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Origin tidak diizinkan oleh CORS: " + origin));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.send("Backend Sistem Informasi Pemagangan Mahasiswa berjalan");
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/mahasiswa", mahasiswaRoutes);
app.use("/api/perusahaan", perusahaanRoutes);
app.use("/api/perusahaan", perusahaanProfileRoutes);
app.use("/api/lowongan", lowonganRoutes);
app.use("/api/dosen", dosenRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/users", userRoutes);
app.use("/api/lamaran", lamaranRoutes);
app.use("/api/rekrutmen", rekrutmenRoutes);
app.use("/api/notifikasi", notifikasiRoutes);
app.use("/api/konversi-sks", konversiSksRoutes);
app.use("/api/dosen/persetujuan-konversi", persetujuanKonversiRoutes);
app.use("/api/verifikasi-perusahaan", verifikasiPerusahaanRoutes);
app.use("/api/laporan-magang", laporanMagangRoutes);
app.use("/api/pengajuan-dosen", pengajuanDosenRoutes);
app.use("/api/admin/lowongan", adminLowonganRoutes);
app.use("/api/perusahaan/mahasiswa-magang", magangRoutes);
app.use("/api/admin/persetujuan-konversi", persetujuanKonversiAdminRoutes);

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});