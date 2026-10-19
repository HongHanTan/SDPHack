import { SitePhotoData } from '../types';

export const SITE_PHOTOS_CATALOG: Record<string, SitePhotoData> = {
  // Critical Low-point Junction & Curb Inlet
  'NODE-J07': {
    assetId: 'NODE-J07',
    title: 'MH-0421 Main Gravity Drop Chamber',
    locationName: 'Cedar View Estates · Cul-de-sac Lowland Inflow Junction',
    captureDate: '2026-10-19 14:15:20 MYT',
    photographer: 'Inspector Azman (Field Unit A)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 0.0,
    observedCondition:
      'Heavy-duty ductile iron cover seated securely. Chamber drop 1.62m with ~15cm fine silt deposition in sump pit; no structural crack defects detected.',
    siltDepthMm: 150,
    structuralIntegrityPct: 92,
  },
  'INLET-D07': {
    assetId: 'INLET-D07',
    title: 'INLET-D07 Combination Curb Grate & Throat',
    locationName: 'Cedar View Estates · Cul-de-sac Street End Inlet',
    captureDate: '2026-10-19 14:18:45 MYT',
    photographer: 'Inspector Azman (Field Unit A)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    observedCondition:
      'Grate surface severely obstructed by leaf litter and roadside runoff sediment (~65% visual coverage). Curb opening throat throttled; immediate desilting crew dispatch recommended.',
    siltDepthMm: 180,
    structuralIntegrityPct: 88,
  },
  'PIPE-P07': {
    assetId: 'PIPE-P07',
    title: 'PIPE-P07 Reinforced Concrete Pipe (RCP Ø600mm) CCTV Feed',
    locationName: 'Cedar View Estates → Retention Pond Confluence Conduit',
    captureDate: '2026-10-19 14:25:10 MYT',
    photographer: 'CCTV Crawler Unit B (Siti)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 14.8,
    observedCondition:
      'In-pipe CCTV inspection reveals 120mm consolidated silt bed along pipe invert. Light biological biofilm on crown, joint rubber gaskets intact with no infiltration leaks; flow capacity utilization 78%.',
    siltDepthMm: 120,
    structuralIntegrityPct: 85,
  },

  // Retention Pond Inflow Structure
  'NODE-J06': {
    assetId: 'NODE-J06',
    title: 'NODE-J06 Retention Pond Sedimentation Intake',
    locationName: 'Maple Grove Retention Pond · North Inflow Forebay',
    captureDate: '2026-10-19 14:32:00 MYT',
    photographer: 'Inspector Muthu (Field Unit C)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    observedCondition:
      'Energy dissipating weir and floating debris boom operating smoothly; lake stage normal. Coarse debris screen clear of large refuse; sedimentation forebay capacity at 72%.',
    siltDepthMm: 80,
    structuralIntegrityPct: 95,
  },
  'PIPE-P06': {
    assetId: 'PIPE-P06',
    title: 'PIPE-P06 Pond Inflow Branch (RCP Ø600mm)',
    locationName: 'Pinecrest Trunk → Maple Grove Pond',
    captureDate: '2026-10-19 14:35:12 MYT',
    photographer: 'CCTV Crawler Unit B (Siti)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 22.4,
    observedCondition:
      'Smooth pipe barrel wall, steady hydraulic grade line; zero joint displacement or structural deformation detected.',
    siltDepthMm: 45,
    structuralIntegrityPct: 96,
  },

  // Outfall & East Drain Canal
  'NODE-OUT01': {
    assetId: 'NODE-OUT01',
    title: 'NODE-OUT01 East Drain Outfall Headwall',
    locationName: 'Riverside Heights · Southeast Outfall Headwall',
    captureDate: '2026-10-19 14:40:15 MYT',
    photographer: 'Inspector Kevin (Field Unit D)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    observedCondition:
      'Twin-cell reinforced concrete headwall with flexible flap gates. Flap gates free of corrosion and debris fouling; riprap embankment stable, receiving canal tailwater level nominal.',
    siltDepthMm: 30,
    structuralIntegrityPct: 98,
  },
  'PIPE-P08': {
    assetId: 'PIPE-P08',
    title: 'PIPE-P08 Outfall Discharge Trunk (RCP Ø750mm)',
    locationName: 'Maple Grove Pond → Outfall Headwall',
    captureDate: '2026-10-19 14:44:30 MYT',
    photographer: 'Inspector Kevin (Field Unit D)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 31.0,
    observedCondition:
      'Full free-flow cross section with steady gravity discharge; no sediment clogging, structural load rating intact.',
    siltDepthMm: 50,
    structuralIntegrityPct: 94,
  },

  // Midstream Residential Trunk
  'NODE-J04': {
    assetId: 'NODE-J04',
    title: 'NODE-J04 Residential Branch Junction (MH-0312)',
    locationName: 'Pinecrest Residential · Street 2 Intersection',
    captureDate: '2026-10-19 14:05:10 MYT',
    photographer: 'CCTV Crawler Unit B (Siti)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    observedCondition:
      'Manhole ring level and flush with road surface; safety fall protection mesh intact and secure, calm internal flow.',
    siltDepthMm: 60,
    structuralIntegrityPct: 91,
  },
  'PIPE-P04': {
    assetId: 'PIPE-P04',
    title: 'PIPE-P04 Residential Collector Branch (RCP Ø450mm)',
    locationName: 'Pinecrest Residential Main Street',
    captureDate: '2026-10-19 14:10:05 MYT',
    photographer: 'CCTV Crawler Unit B (Siti)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 18.2,
    observedCondition:
      'Minor capillary tree root intrusion on inner crown (marked for routine maintenance); flow capacity slightly reduced (~15% area restriction).',
    siltDepthMm: 70,
    structuralIntegrityPct: 87,
  },

  // Upstream Subdivisions
  'NODE-J01': {
    assetId: 'NODE-J01',
    title: 'NODE-J01 North Ridge Crest Origin Manhole (MH-0101)',
    locationName: 'North Ridge Subdivision · High Elevation Point',
    captureDate: '2026-10-19 13:50:00 MYT',
    photographer: 'Inspector Azman (Field Unit A)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    observedCondition:
      'Drainage network headwaters, pipe invert elevation 114.2m. Dry chamber with zero backwater, structural integrity optimal.',
    siltDepthMm: 20,
    structuralIntegrityPct: 99,
  },
  'PIPE-P01': {
    assetId: 'PIPE-P01',
    title: 'PIPE-P01 Headwater Collector Pipe (RCP Ø450mm)',
    locationName: 'North Ridge Subdivision Lateral',
    captureDate: '2026-10-19 13:55:00 MYT',
    photographer: 'Inspector Azman (Field Unit A)',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: 10.0,
    observedCondition:
      'Sound hydraulic slope, clean pipe barrel free of silt or debris deposition.',
    siltDepthMm: 15,
    structuralIntegrityPct: 98,
  },
};

export function getSitePhotoForAsset(assetId: string): SitePhotoData {
  if (SITE_PHOTOS_CATALOG[assetId]) {
    return SITE_PHOTOS_CATALOG[assetId];
  }

  // Fallback generation for any other conduit or node
  const isConduit = assetId.startsWith('PIPE') || assetId.startsWith('C');
  return {
    assetId,
    title: isConduit
      ? `${assetId} In-Pipe CCTV Crawler Inspection`
      : `${assetId} Surface Manhole Inspection`,
    locationName: 'Taman Kyra Township Drainage Sector',
    captureDate: '2026-10-19 14:00:00 MYT',
    photographer: 'Township Mobile Patrol Unit',
    surfacePhotoUrl: '/assets/mock_manhole.jpg',
    cctvPhotoUrl: '',
    chainageM: isConduit ? 12.5 : undefined,
    observedCondition: isConduit
      ? 'Conduit clear, stable hydraulic grade line, CCTV crawler detected no major structural cracks or fractures.'
      : 'Surface manhole structure intact, safety net secured, surrounding pavement free of sinkholes or voiding.',
    siltDepthMm: 50,
    structuralIntegrityPct: 90,
  };
}
