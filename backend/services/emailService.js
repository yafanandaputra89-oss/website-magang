const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
    },
});

const EMAIL_TEMPLATES = {
        BERKAS_DITERIMA: (nama, posisi, perusahaan) => ({
            subject: `✅ Berkas Anda Disetujui — ${posisi} di ${perusahaan}`,
            html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Selamat! Berkas lamaran Anda untuk posisi <b>${posisi}</b> di <b>${perusahaan}</b> telah disetujui.</p>
      <p>Anda akan segera mendapatkan informasi jadwal interview. Pantau terus aplikasi kami.</p>
      <p>Semangat! 🎉</p>
    `,
        }),

        BERKAS_DITOLAK: (nama, posisi, perusahaan) => ({
            subject: `Informasi Seleksi Berkas — ${posisi} di ${perusahaan}`,
            html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Terima kasih telah melamar posisi <b>${posisi}</b> di <b>${perusahaan}</b>.</p>
      <p>Mohon maaf, setelah melalui proses seleksi berkas, kami belum bisa melanjutkan lamaran Anda saat ini.</p>
      <p>Jangan menyerah, terus semangat mencari kesempatan lainnya!</p>
    `,
        }),

        INTERVIEW_DIJADWALKAN: (nama, posisi, perusahaan, jadwal) => ({
                    subject: `📅 Jadwal Interview — ${posisi} di ${perusahaan}`,
                    html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Berkas Anda telah lolos dan Anda dijadwalkan untuk interview:</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Tanggal</td><td><b>${new Date(jadwal.tanggal).toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Jam</td><td><b>${jadwal.jam} WIB</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Lokasi</td><td><b>${jadwal.lokasi}</b></td></tr>
        ${jadwal.linkMeeting ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Link Meeting</td><td><a href="${jadwal.linkMeeting}">${jadwal.linkMeeting}</a></td></tr>` : ""}
      </table>
      <p>Harap hadir tepat waktu. Semoga sukses!</p>
    `,
  }),

  LOLOS_INTERVIEW: (nama, posisi, perusahaan) => ({
    subject: `🎊 Selamat, Anda Lolos Interview — ${posisi}`,
    html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Selamat! Anda dinyatakan <b>lolos</b> tahap interview untuk posisi <b>${posisi}</b> di <b>${perusahaan}</b>.</p>
      <p>Kami akan segera menginformasikan hasil akhir seleksi. Tetap semangat!</p>
    `,
  }),

  TIDAK_LOLOS_INTERVIEW: (nama, posisi, perusahaan) => ({
    subject: `Informasi Hasil Interview — ${posisi} di ${perusahaan}`,
    html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Terima kasih telah mengikuti proses interview untuk posisi <b>${posisi}</b> di <b>${perusahaan}</b>.</p>
      <p>Mohon maaf, Anda belum lolos pada tahap interview kali ini. Terus tingkatkan kemampuan dan jangan menyerah!</p>
    `,
  }),

  DITERIMA_MAGANG: (nama, posisi, perusahaan) => ({
    subject: `🏆 Selamat! Anda Diterima Magang — ${posisi} di ${perusahaan}`,
    html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Selamat besar! Anda telah <b>resmi diterima</b> sebagai peserta magang untuk posisi <b>${posisi}</b> di <b>${perusahaan}</b>.</p>
      <p>Tim kami akan segera menghubungi Anda untuk informasi lebih lanjut mengenai onboarding.</p>
      <p>Selamat bergabung! 🎉</p>
    `,
  }),

  DITOLAK: (nama, posisi, perusahaan) => ({
    subject: `Informasi Hasil Seleksi — ${posisi} di ${perusahaan}`,
    html: `
      <p>Halo <b>${nama}</b>,</p>
      <p>Terima kasih atas antusiasme Anda melamar posisi <b>${posisi}</b> di <b>${perusahaan}</b>.</p>
      <p>Mohon maaf, setelah melalui seluruh proses seleksi, kami belum bisa menerima Anda saat ini.</p>
      <p>Semoga ada kesempatan lain di masa depan. Tetap semangat!</p>
    `,
  }),
};

async function kirimEmail(toEmail, templateKey, ...args) {
  const template = EMAIL_TEMPLATES[templateKey];
  if (!template) return;
  const { subject, html } = template(...args);
  await transporter.sendMail({
    from: `"Portal Magang" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
}

module.exports = { kirimEmail };