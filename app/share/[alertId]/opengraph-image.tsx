import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { alertId: string } }) {
  const alert = await prisma.alert.findUnique({ where: { id: params.alertId }, include: { area: true } });
  if (!alert) {
    return new ImageResponse(<div>Not found</div>, { ...size });
  }
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0ea5e9', color: '#fff', padding: 40, flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 36, fontWeight: 700 }}>Telangana Weather Live</div>
        <div style={{ fontSize: 56, fontWeight: 800 }}>{alert.area.name}</div>
        <div style={{ fontSize: 32 }}>{alert.textEn}</div>
        <div style={{ fontSize: 24 }}>{alert.textTe}</div>
        <div style={{ fontSize: 18, opacity: 0.9 }}>Window: {alert.windowStart.toISOString()} → {alert.windowEnd.toISOString()}</div>
      </div>
    ),
    { ...size },
  );
}


