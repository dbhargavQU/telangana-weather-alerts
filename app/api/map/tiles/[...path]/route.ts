import { NextRequest, NextResponse } from 'next/server';

// Simple proxy pass-through for tiles (RainViewer or OSM)
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const target = 'https://' + params.path.join('/');
  const res = await fetch(target, { headers: { 'User-Agent': 'WeathermanTileProxy/1.0' } });
  const buf = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buf, {
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/png', 'Cache-Control': 'public, max-age=300' },
    status: res.status,
  });
}


