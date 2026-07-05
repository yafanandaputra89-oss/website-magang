/**
 * scripts/backfillMagang.js
 *
 * Tujuan:
 *   Untuk lamaran yang SUDAH berstatus KONFIRMASI_DITERIMA sebelum fix
 *   ini diterapkan, record `Magang` belum pernah dibuat (karena kode
 *   lama tidak membuatnya). Script ini membuatkan record Magang yang
 *   hilang tersebut, sekali jalan (idempotent — aman dijalankan
 *   berkali-kali karena hanya memproses lamaran yang belum punya Magang).
 *
 * Cara jalankan (dari root folder backend):
 *   node scripts/backfillMagang.js
 *
 * Setelah ini dijalankan, seluruh lamaran KONFIRMASI_DITERIMA akan
 * langsung muncul di halaman "Daftar Mahasiswa Magang" milik perusahaan.
 */

const prisma = require("../config/prisma");

async function run() {
    console.log("Mencari lamaran KONFIRMASI_DITERIMA yang belum punya record Magang...");

    const lamarans = await prisma.lamaran.findMany({
        where: {
            status: "KONFIRMASI_DITERIMA",
            magang: null, // belum ada record Magang terkait
        },
        select: {
            id: true,
            name: true,
            startDate: true,
        },
    });

    if (lamarans.length === 0) {
        console.log("Tidak ada data yang perlu di-backfill. Semua sudah beres.");
        return;
    }

    console.log(`Ditemukan ${lamarans.length} lamaran yang perlu dibuatkan Magang:\n`);

    let sukses = 0;
    let gagal = 0;

    for (const l of lamarans) {
        try {
            await prisma.magang.create({
                data: {
                    lamaranId: l.id,
                    tanggalMulai: l.startDate,
                    status: "Aktif",
                },
            });
            console.log(`  ✓ Lamaran #${l.id} (${l.name}) → Magang dibuat`);
            sukses += 1;
        } catch (err) {
            console.error(`  ✗ Lamaran #${l.id} (${l.name}) GAGAL: ${err.message}`);
            gagal += 1;
        }
    }

    console.log(`\nSelesai. Berhasil: ${sukses}, Gagal: ${gagal}, Total: ${lamarans.length}`);
}

run()
    .catch((err) => {
        console.error("ERROR TAK TERDUGA:", err);
        process.exitCode = 1;
    })
    .finally(async() => {
        await prisma.$disconnect();
        process.exit();
    });