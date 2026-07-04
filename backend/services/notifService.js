const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const NOTIF_COPY = {
    BERKAS_DITERIMA: { judul: "Berkas Disetujui 🎉", pesan: "Berkas Anda telah disetujui dan Anda akan melanjutkan ke tahap interview." },
    BERKAS_DITOLAK: { judul: "Berkas Ditolak", pesan: "Mohon maaf, berkas Anda belum lolos seleksi berkas." },
    INTERVIEW_DIJADWALKAN: { judul: "Interview Dijadwalkan 📅", pesan: "Jadwal interview Anda telah ditetapkan. Cek detail di halaman lamaran." },
    LOLOS_INTERVIEW: { judul: "Lolos Interview 🎊", pesan: "Selamat! Anda dinyatakan lolos tahap interview." },
    TIDAK_LOLOS_INTERVIEW: { judul: "Tidak Lolos Interview", pesan: "Mohon maaf, Anda belum lolos tahap interview." },
    DITERIMA_MAGANG: { judul: "Diterima Magang 🏆", pesan: "Selamat! Anda telah resmi diterima sebagai peserta magang." },
    DITOLAK: { judul: "Lamaran Ditolak", pesan: "Mohon maaf, Anda belum lolos pada tahap seleksi saat ini." },
};

async function buatNotifikasi(userId, lamaranId, statusKey) {
    const copy = NOTIF_COPY[statusKey];
    if (!copy) return;
    await prisma.notifikasi.create({
        data: { userId, lamaranId, judul: copy.judul, pesan: copy.pesan },
    });
}

module.exports = { buatNotifikasi };