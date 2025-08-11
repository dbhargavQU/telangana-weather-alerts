import { randomUUID } from 'node:crypto';

type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lng,lat], ... ] ]
};

type SeedArea = {
  id: string;
  name: string;
  type: 'district' | 'neighbourhood';
  polygon: GeoJSONPolygon;
  centroid?: { lat: number; lon: number };
  polyQuality?: 'bbox' | 'official';
};

function bboxPolygon(minLng: number, minLat: number, maxLng: number, maxLat: number): GeoJSONPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

function bboxAroundCentroid(lon: number, lat: number, halfSizeDeg: number): GeoJSONPolygon {
  return bboxPolygon(lon - halfSizeDeg, lat - halfSizeDeg, lon + halfSizeDeg, lat + halfSizeDeg);
}

const baseAreas = [
  {
    id: 'dist-hyd',
    name: 'Hyderabad District',
    type: 'district',
    centroid: { lat: 17.385, lon: 78.486 },
    polygon: { type: 'Polygon', coordinates: [[[78.31,17.26],[78.66,17.26],[78.66,17.51],[78.31,17.51],[78.31,17.26]]] },
  },
  {
    id: 'dist-rangareddy',
    name: 'Ranga Reddy District',
    type: 'district',
    centroid: { lat: 17.20, lon: 78.08 },
    polygon: { type: 'Polygon', coordinates: [[[77.90,17.03],[78.26,17.03],[78.26,17.37],[77.90,17.37],[77.90,17.03]]] },
  },
  { id: 'dist-vikarabad', name: 'Vikarabad District', type: 'district', centroid: { lat: 17.34, lon: 77.91 }, polygon: { type: 'Polygon', coordinates: [[[77.73,17.17],[78.09,17.17],[78.09,17.51],[77.73,17.51],[77.73,17.17]]] } },
  { id: 'dist-sangareddy', name: 'Sangareddy District', type: 'district', centroid: { lat: 17.62, lon: 78.08 }, polygon: { type: 'Polygon', coordinates: [[[77.90,17.45],[78.26,17.45],[78.26,17.79],[77.90,17.79],[77.90,17.45]]] } },
  { id: 'dist-mahabubnagar', name: 'Mahabubnagar District', type: 'district', centroid: { lat: 16.74, lon: 77.99 }, polygon: { type: 'Polygon', coordinates: [[[77.81,16.57],[78.17,16.57],[78.17,16.91],[77.81,16.91],[77.81,16.57]]] } },
  { id: 'dist-nagarkurnool', name: 'Nagarkurnool District', type: 'district', centroid: { lat: 16.48, lon: 78.31 }, polygon: { type: 'Polygon', coordinates: [[[78.13,16.31],[78.49,16.31],[78.49,16.65],[78.13,16.65],[78.13,16.31]]] } },
  { id: 'dist-wanaparthy', name: 'Wanaparthy District', type: 'district', centroid: { lat: 16.36, lon: 78.06 }, polygon: { type: 'Polygon', coordinates: [[[77.88,16.19],[78.24,16.19],[78.24,16.53],[77.88,16.53],[77.88,16.19]]] } },
  { id: 'dist-narayanpet', name: 'Narayanpet District', type: 'district', centroid: { lat: 16.75, lon: 77.50 }, polygon: { type: 'Polygon', coordinates: [[[77.32,16.58],[77.68,16.58],[77.68,16.92],[77.32,16.92],[77.32,16.58]]] } },
  { id: 'dist-gadwal', name: 'Jogulamba-Gadwal District', type: 'district', centroid: { lat: 16.23, lon: 77.80 }, polygon: { type: 'Polygon', coordinates: [[[77.62,16.06],[77.98,16.06],[77.98,16.40],[77.62,16.40],[77.62,16.06]]] } },
  { id: 'dist-nalgonda', name: 'Nalgonda District', type: 'district', centroid: { lat: 17.05, lon: 79.27 }, polygon: { type: 'Polygon', coordinates: [[[79.09,16.88],[79.45,16.88],[79.45,17.22],[79.09,17.22],[79.09,16.88]]] } },
  { id: 'dist-yadadri', name: 'Yadadri-Bhongir District', type: 'district', centroid: { lat: 17.51, lon: 78.89 }, polygon: { type: 'Polygon', coordinates: [[[78.71,17.34],[79.07,17.34],[79.07,17.68],[78.71,17.68],[78.71,17.34]]] } },
  { id: 'dist-mahabubabad', name: 'Mahabubabad District', type: 'district', centroid: { lat: 17.60, lon: 80.00 }, polygon: { type: 'Polygon', coordinates: [[[79.82,17.43],[80.18,17.43],[80.18,17.77],[79.82,17.77],[79.82,17.43]]] } },
  { id: 'dist-khammam', name: 'Khammam District', type: 'district', centroid: { lat: 17.25, lon: 80.15 }, polygon: { type: 'Polygon', coordinates: [[[79.97,17.08],[80.33,17.08],[80.33,17.42],[79.97,17.42],[79.97,17.08]]] } },
  { id: 'dist-hanamkonda', name: 'Hanamkonda (Warangal) District', type: 'district', centroid: { lat: 17.99, lon: 79.59 }, polygon: { type: 'Polygon', coordinates: [[[79.41,17.82],[79.77,17.82],[79.77,18.16],[79.41,18.16],[79.41,17.82]]] } },
  { id: 'dist-bhadradri', name: 'Bhadradri-Kothagudem District', type: 'district', centroid: { lat: 17.55, lon: 80.64 }, polygon: { type: 'Polygon', coordinates: [[[80.46,17.38],[80.82,17.38],[80.82,17.72],[80.46,17.72],[80.46,17.38]]] } },
  { id: 'dist-mulugu', name: 'Mulugu District', type: 'district', centroid: { lat: 18.19, lon: 79.94 }, polygon: { type: 'Polygon', coordinates: [[[79.76,18.02],[80.12,18.02],[80.12,18.36],[79.76,18.36],[79.76,18.02]]] } },
  // Hyderabad neighbourhoods (rough bboxes for MVP)
  {
    id: 'nbhd-lb-nagar',
    name: 'LB Nagar, Hyderabad',
    type: 'neighbourhood',
    centroid: { lat: 17.357, lon: 78.557 },
    polygon: { type: 'Polygon', coordinates: [[[78.517,17.317],[78.597,17.317],[78.597,17.397],[78.517,17.397],[78.517,17.317]]] },
  },
  {
    id: 'nbhd-kapra',
    name: 'Kapra, Hyderabad',
    type: 'neighbourhood',
    centroid: { lat: 17.478, lon: 78.577 },
    polygon: { type: 'Polygon', coordinates: [[[78.537,17.438],[78.617,17.438],[78.617,17.518],[78.537,17.518],[78.537,17.438]]] },
  },
  {
    id: 'nbhd-uppal',
    name: 'Uppal, Hyderabad',
    type: 'neighbourhood',
    centroid: { lat: 17.405, lon: 78.559 },
    polygon: { type: 'Polygon', coordinates: [[[78.519,17.365],[78.599,17.365],[78.599,17.445],[78.519,17.445],[78.519,17.365]]] },
  },
  {
    id: 'nbhd-kukatpally',
    name: 'Kukatpally, Hyderabad',
    type: 'neighbourhood',
    centroid: { lat: 17.493, lon: 78.413 },
    polygon: { type: 'Polygon', coordinates: [[[78.373,17.453],[78.453,17.453],[78.453,17.533],[78.373,17.533],[78.373,17.453]]] },
  },
] as const satisfies ReadonlyArray<SeedArea>;

// Additional districts for full Telangana coverage (approx centroids; bbox polygons)
const districtC = (id: string, name: string, lon: number, lat: number): SeedArea => ({
  id,
  name,
  type: 'district',
  centroid: { lat, lon },
  polygon: bboxAroundCentroid(lon, lat, 0.175),
});

const neighbourhoodC = (id: string, name: string, lon: number, lat: number): SeedArea => ({
  id,
  name,
  type: 'neighbourhood',
  centroid: { lat, lon },
  polygon: bboxAroundCentroid(lon, lat, 0.04),
});

const moreAreas: SeedArea[] = [
  // Districts (33 total including previously added)
  districtC('dist-adilabad', 'Adilabad District', 78.53, 19.67),
  districtC('dist-asifabad', 'Kumuram Bheem Asifabad District', 79.00, 19.37),
  districtC('dist-mancherial', 'Mancherial District', 79.45, 18.88),
  districtC('dist-nirmal', 'Nirmal District', 78.35, 19.10),
  districtC('dist-nizamabad', 'Nizamabad District', 78.10, 18.67),
  districtC('dist-kamareddy', 'Kamareddy District', 78.34, 18.32),
  districtC('dist-jagtial', 'Jagtial District', 78.91, 18.79),
  districtC('dist-karimnagar', 'Karimnagar District', 79.13, 18.44),
  districtC('dist-rajanna-sircilla', 'Rajanna Sircilla District', 78.83, 18.38),
  districtC('dist-peddapalli', 'Peddapalli District', 79.37, 18.62),
  districtC('dist-jayashankar-bhupalpally', 'Jayashankar Bhupalpally District', 80.00, 18.46),
  // Mulugu exists above
  // Bhadradri exists above
  // Khammam exists above
  // Mahabubabad exists above
  districtC('dist-warangal', 'Warangal District', 79.58, 18.00),
  // Hanamkonda exists above
  districtC('dist-jangaon', 'Jangaon District', 79.15, 17.73),
  // Yadadri exists above
  districtC('dist-suryapet', 'Suryapet District', 79.63, 17.14),
  // Nalgonda exists above
  districtC('dist-medchal-malkajgiri', 'Medchal–Malkajgiri District', 78.52, 17.50),
  districtC('dist-hyderabad', 'Hyderabad District', 78.49, 17.38),
  // Ranga Reddy exists above
  // Vikarabad exists above
  // Sangareddy exists above
  districtC('dist-medak', 'Medak District', 78.27, 18.04),
  districtC('dist-siddipet', 'Siddipet District', 78.85, 18.10),
  // Mahabubnagar exists above
  // Narayanpet exists above
  // Nagarkurnool exists above
  // Wanaparthy exists above
  // Jogulamba-Gadwal exists above

  // Hyderabad neighbourhoods (additional)
  neighbourhoodC('nbhd-hayathnagar', 'Hayathnagar, Hyderabad', 78.60, 17.33),
  neighbourhoodC('nbhd-moosapet', 'Moosapet, Hyderabad', 78.43, 17.46),
  neighbourhoodC('nbhd-qutbullapur', 'Qutbullapur, Hyderabad', 78.44, 17.51),
  neighbourhoodC('nbhd-gajularamaram', 'Gajularamaram, Hyderabad', 78.43, 17.53),
  neighbourhoodC('nbhd-alwal', 'Alwal, Hyderabad', 78.51, 17.50),
  neighbourhoodC('nbhd-malkajgiri', 'Malkajgiri, Hyderabad', 78.54, 17.45),
  neighbourhoodC('nbhd-amberpet', 'Amberpet, Hyderabad', 78.52, 17.40),
  neighbourhoodC('nbhd-begumpet', 'Begumpet, Hyderabad', 78.47, 17.45),
  neighbourhoodC('nbhd-musheerabad', 'Musheerabad, Hyderabad', 78.49, 17.42),
  neighbourhoodC('nbhd-charminar', 'Charminar, Hyderabad', 78.47, 17.36),
  neighbourhoodC('nbhd-falaknuma', 'Falaknuma, Hyderabad', 78.47, 17.32),
  neighbourhoodC('nbhd-chandrayangutta', 'Chandrayangutta, Hyderabad', 78.49, 17.32),
  neighbourhoodC('nbhd-santoshnagar', 'Santoshnagar, Hyderabad', 78.52, 17.35),
  neighbourhoodC('nbhd-serilingampally', 'Serilingampally, Hyderabad', 78.32, 17.49),
  neighbourhoodC('nbhd-gachibowli', 'Gachibowli, Hyderabad', 78.35, 17.44),
  neighbourhoodC('nbhd-hitech-city', 'HITEC City, Hyderabad', 78.38, 17.45),
  neighbourhoodC('nbhd-madhapur', 'Madhapur, Hyderabad', 78.39, 17.45),
  neighbourhoodC('nbhd-jubilee-hills', 'Jubilee Hills, Hyderabad', 78.41, 17.43),
  neighbourhoodC('nbhd-banjara-hills', 'Banjara Hills, Hyderabad', 78.43, 17.42),
  neighbourhoodC('nbhd-mehdipatnam', 'Mehdipatnam, Hyderabad', 78.43, 17.40),
  neighbourhoodC('nbhd-tolichowki', 'Tolichowki, Hyderabad', 78.38, 17.41),
  neighbourhoodC('nbhd-secunderabad', 'Secunderabad, Hyderabad', 78.50, 17.45),
];

export const publicAreas: SeedArea[] = [...baseAreas, ...moreAreas].map((a) => ({
  id: a.id ?? randomUUID(),
  name: a.name,
  type: a.type,
  polygon: a.polygon,
  centroid: a.centroid,
  polyQuality: 'bbox',
}));

export type { SeedArea, GeoJSONPolygon };


