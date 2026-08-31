export const SHOP_LOCATION = {
  name: 'JD Car Rental — CHMSU Talisay',
  lat: 10.7391,
  lng: 122.9691,
};

/** Haversine distance between two lat/lng points in kilometres. */
export function getDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const NEGROS_MUNICIPALITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Negros Occidental — Cities
  'Bacolod':            { lat: 10.6765, lng: 122.9509 },
  'Bago':               { lat: 10.5368, lng: 122.8375 },
  'Cadiz':              { lat: 10.9566, lng: 123.3029 },
  'Escalante':          { lat: 10.8382, lng: 123.4997 },
  'Himamaylan':         { lat: 10.0972, lng: 122.8692 },
  'Kabankalan':         { lat:  9.9936, lng: 122.8147 },
  'La Carlota':         { lat: 10.4228, lng: 122.9194 },
  'Sagay':              { lat: 10.8955, lng: 123.4196 },
  'San Carlos':         { lat: 10.4928, lng: 123.4144 },
  'Silay':              { lat: 10.7967, lng: 122.9739 },
  'Talisay':            { lat: 10.7391, lng: 122.9691 },
  'Victorias':          { lat: 10.9002, lng: 123.0758 },
  // Negros Occidental — Municipalities
  'Binalbagan':         { lat: 10.2007, lng: 122.8620 },
  'Calatrava':          { lat: 10.5944, lng: 123.5133 },
  'Candoni':            { lat:  9.8278, lng: 122.6392 },
  'Cauayan':            { lat:  9.7754, lng: 122.6747 },
  'Enrique B. Magalona':{ lat: 10.8454, lng: 123.0285 },
  'Hinigaran':          { lat: 10.2714, lng: 122.8543 },
  'Hinoba-an':          { lat:  9.5372, lng: 122.5106 },
  'Ilog':               { lat: 10.0216, lng: 122.7748 },
  'Isabela':            { lat: 10.2004, lng: 122.9863 },
  'La Castellana':      { lat: 10.3524, lng: 123.0617 },
  'Manapla':            { lat: 10.9554, lng: 123.1248 },
  'Moises Padilla':     { lat: 10.2543, lng: 123.0817 },
  'Murcia':             { lat: 10.6049, lng: 123.0360 },
  'Pontevedra':         { lat: 10.3757, lng: 122.8448 },
  'Pulupandan':         { lat: 10.5128, lng: 122.8026 },
  'Salvador Benedicto': { lat: 10.5474, lng: 123.1565 },
  'San Enrique':        { lat: 10.4086, lng: 122.8290 },
  'Sipalay':            { lat:  9.7534, lng: 122.4028 },
  'Toboso':             { lat: 10.7226, lng: 123.5135 },
  'Valladolid':         { lat: 10.4007, lng: 122.8032 },
  // Negros Oriental — Cities
  'Bayawan':            { lat:  9.3670, lng: 122.8042 },
  'Bais':               { lat:  9.5913, lng: 123.1205 },
  'Canlaon':            { lat: 10.3877, lng: 123.1986 },
  'Dumaguete':          { lat:  9.3068, lng: 123.3054 },
  'Guihulngan':         { lat: 10.1210, lng: 123.2729 },
  'Tanjay':             { lat:  9.5157, lng: 123.1582 },
  // Negros Oriental — Municipalities
  'Amlan':              { lat:  9.4283, lng: 123.2401 },
  'Ayungon':            { lat:  9.8192, lng: 123.0213 },
  'Bacong':             { lat:  9.2502, lng: 123.2888 },
  'Basay':              { lat:  9.6796, lng: 122.6487 },
  'Bindoy':             { lat:  9.8019, lng: 123.0822 },
  'Dauin':              { lat:  9.2001, lng: 123.2667 },
  'Jimalalud':          { lat:  9.9677, lng: 123.1511 },
  'La Libertad':        { lat:  9.9823, lng: 123.5062 },
  'Mabinay':            { lat:  9.7318, lng: 122.9157 },
  'Manjuyod':           { lat:  9.6868, lng: 123.1632 },
  'Pamplona':           { lat:  9.5135, lng: 122.9574 },
  'San Jose':           { lat:  9.5517, lng: 123.0540 },
  'Santa Catalina':     { lat:  9.3317, lng: 122.8667 },
  'Siaton':             { lat:  9.0597, lng: 122.9614 },
  'Sibulan':            { lat:  9.3597, lng: 123.2699 },
  'Tayasan':            { lat:  9.9205, lng: 123.1465 },
  'Valencia':           { lat:  9.2879, lng: 123.2530 },
  'Vallehermoso':       { lat: 10.3571, lng: 123.4873 },
  'Zamboanguita':       { lat:  9.1017, lng: 123.1742 },
};

export function getMunicipalityCoords(name: string): { lat: number; lng: number } | null {
  return NEGROS_MUNICIPALITY_COORDS[name] ?? null;
}

/**
 * Generates a circle approximation polygon (N points) for storage in polygonCoordinates.
 * Used when creating auto-geofence zones from a center point + radius.
 */
export function generateCirclePolygon(
  lat: number,
  lng: number,
  radiusKm: number,
  points = 32
): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];
  const latRad = lat * (Math.PI / 180);
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLng = (radiusKm / (111.32 * Math.cos(latRad))) * Math.sin(angle);
    coords.push({ lat: lat + dLat, lng: lng + dLng });
  }
  return coords;
}

/**
 * Point-in-circle check: returns true if (pLat, pLng) is within radiusKm of (cLat, cLng).
 * Uses Haversine formula.
 */
export function isPointInCircle(
  pLat: number, pLng: number,
  cLat: number, cLng: number,
  radiusKm: number
): boolean {
  const R = 6371; // Earth radius km
  const dLat = (pLat - cLat) * (Math.PI / 180);
  const dLng = (pLng - cLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(cLat * (Math.PI / 180)) * Math.cos(pLat * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distKm <= radiusKm;
}

const GEOFENCE_BUFFER_KM = 20;

/** Compute geofence center (the configured shop or default SHOP_LOCATION) and radius (distance + buffer). */
export function computeGeofence(
  destinationName: string,
  shopCenter?: { lat: number; lng: number } | null
): {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
} | null {
  const destCoords = getMunicipalityCoords(destinationName);
  if (!destCoords) return null;

  const shop = (shopCenter && !isNaN(shopCenter.lat) && !isNaN(shopCenter.lng))
    ? shopCenter
    : { lat: SHOP_LOCATION.lat, lng: SHOP_LOCATION.lng };

  const distance = getDistanceKm(
    shop.lat, shop.lng,
    destCoords.lat, destCoords.lng
  );

  const radiusKm = Math.max(GEOFENCE_BUFFER_KM, Math.ceil(distance + GEOFENCE_BUFFER_KM));

  return { centerLat: shop.lat, centerLng: shop.lng, radiusKm };
}
