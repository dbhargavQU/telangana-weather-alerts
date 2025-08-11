'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const LeafletMap = dynamic(async () => (await import('./MapInner')).MapInner, { ssr: false });

export default function WeatherMap({
  areas,
}: {
  areas: Array<{ id: string; name: string; polygon: any }>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <LeafletMap areas={areas} />;
}


