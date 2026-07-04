const prisma = require("../config/prisma");
const slugify = require("slugify");

async function main() {
    const allLowongan = await prisma.lowongan.findMany({
        where: { slug: null },
    });

    console.log(`Ditemukan ${allLowongan.length} lowongan tanpa slug.`);

    for (const item of allLowongan) {
        const base = slugify(item.posisi, { lower: true, strict: true });
        const suffix = Math.random().toString(36).substring(2, 8);
        const slug = `${base}-${suffix}`;

        await prisma.lowongan.update({
            where: { id: item.id },
            data: { slug },
        });

        console.log(`ID ${item.id} -> ${slug}`);
    }

    console.log("Selesai.");
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());