import { PrismaClient, AreaType } from '@prisma/client';
import { publicAreas } from '@/config/publicAreas';

const prisma = new PrismaClient();

async function main() {
  for (const area of publicAreas) {
    await prisma.area.upsert({
      where: { id: area.id },
      update: {
        name: area.name,
        type: area.type as AreaType,
        polygon: area.polygon,
        centroidLat: area.centroid?.lat,
        centroidLng: area.centroid?.lon,
        polyQuality: area.polyQuality ?? 'bbox',
      } as any,
      create: {
        id: area.id,
        name: area.name,
        type: area.type as AreaType,
        polygon: area.polygon,
        centroidLat: area.centroid?.lat,
        centroidLng: area.centroid?.lon,
        polyQuality: area.polyQuality ?? 'bbox',
      } as any,
    });
  }
  // Seed a hello observation for each area for initial UI
  const areas = await prisma.area.findMany();
  const now = new Date();
  for (const a of areas) {
    await prisma.observation.create({
      data: {
        areaId: a.id,
        observedAt: now,
        rain15: 0,
        rain60: 0,
        maxDbz: 0,
        etaMin: null,
        durationMin: null,
        thunderProb: 0,
        floodProb: 0,
        sources: ['Seed'],
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


