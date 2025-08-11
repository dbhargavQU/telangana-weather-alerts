'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Feature, Polygon } from 'geojson';
import { useState } from 'react';

export function MapInner({ areas }: { areas: Array<{ id: string; name: string; polygon: any }> }) {
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));
  return (
    <MapContainer key={mapKey} center={[17.4, 78.5]} zoom={10} style={{ height: 400, width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
      {areas.map((a) => {
        const feature: Feature<Polygon> = {
          type: 'Feature',
          properties: { name: a.name },
          geometry: a.polygon as Polygon,
        };
        return <GeoJSON key={a.id} data={feature as any} />;
      })}
    </MapContainer>
  );
}


