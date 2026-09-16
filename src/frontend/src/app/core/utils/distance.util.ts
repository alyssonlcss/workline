// Copyright (c) 2026 Alysson Pinheiro. Todos os direitos reservados.
// Software proprietário e confidencial. Uso não autorizado é proibido.

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimates the travel time in minutes based on distance and average speed.
 * @param distanceKm Distance in kilometers
 * @param averageSpeedKmh Average speed in km/h (default 40)
 * @returns Estimated time in minutes
 */
export function estimateTravelTimeMin(distanceKm: number, averageSpeedKmh: number = 40): number {
  if (distanceKm <= 0) return 0;
  return Math.round((distanceKm / averageSpeedKmh) * 60);
}
