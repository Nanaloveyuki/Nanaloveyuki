import { clamp } from '@blackhole/math';

export type DisplayClampState = 'none' | 'min' | 'max';

export type DisplayMappingResult = {
  value: number;
  rawValue: number;
  clampState: DisplayClampState;
};

export const AU_IN_KILOMETERS = 149_597_870.7;
export const AU_IN_METERS = AU_IN_KILOMETERS * 1000;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_YEAR = 31_536_000;
export const BLACK_HOLE_MASS_SOLAR = 4.1e6;
export const SCHWARZSCHILD_RADIUS_AU = 1.97327e-8 * BLACK_HOLE_MASS_SOLAR;
export const ORBIT_DISPLAY_INNER_RADIUS = 10.8;
export const ORBIT_DISPLAY_SCALE = 2.9;
export const ORBIT_DISPLAY_CURVE = 1.85;
export const ORBIT_DISPLAY_MAX_RADIUS = 44.0;
export const BODY_DISPLAY_RADIUS_DIVISOR = 22_000;
export const BODY_DISPLAY_RADIUS_MIN = 0.16;
export const BODY_DISPLAY_RADIUS_MAX = 0.88;

export const normalizeDistanceToMeters = (distance: number, unit: string | undefined) => {
  switch ((unit ?? 'AU').toLowerCase()) {
    case 'm':
      return distance;
    case 'km':
      return distance * 1000;
    case 'au':
    default:
      return distance * AU_IN_METERS;
  }
};

export const normalizePeriodToSeconds = (value: number, unit: string | undefined) => {
  switch ((unit ?? 'days').toLowerCase()) {
    case 'seconds':
      return value;
    case 'hours':
      return value * SECONDS_PER_HOUR;
    case 'years':
      return value * SECONDS_PER_YEAR;
    case 'days':
    default:
      return value * SECONDS_PER_DAY;
  }
};

export const normalizeTemperatureToKelvin = (value: number, unit: string | undefined) => {
  switch ((unit ?? 'K').toLowerCase()) {
    case 'c':
    case 'celsius':
    case 'degc':
    case '°c':
      return value + 273.15;
    case 'k':
    case 'kelvin':
    default:
      return value;
  }
};

export const mapPhysicalRadiusToDisplayRadiusWithMetadata = (
  radiusKilometers: number,
): DisplayMappingResult => {
  const rawValue = radiusKilometers / BODY_DISPLAY_RADIUS_DIVISOR;
  const value = clamp(rawValue, BODY_DISPLAY_RADIUS_MIN, BODY_DISPLAY_RADIUS_MAX);
  const clampState =
    value === rawValue ? 'none' : value === BODY_DISPLAY_RADIUS_MIN ? 'min' : 'max';

  return {
    value,
    rawValue,
    clampState,
  };
};

export const mapPhysicalRadiusToDisplayRadius = (radiusKilometers: number) =>
  mapPhysicalRadiusToDisplayRadiusWithMetadata(radiusKilometers).value;

export const mapPhysicalOrbitToDisplayRadiusFromAuWithMetadata = (
  distanceAu: number,
): DisplayMappingResult => {
  const distanceInSchwarzschildRadii = distanceAu / SCHWARZSCHILD_RADIUS_AU;
  const compressedDistance = Math.pow(
    Math.log10(distanceInSchwarzschildRadii + 1.0),
    ORBIT_DISPLAY_CURVE,
  );
  const rawValue = ORBIT_DISPLAY_INNER_RADIUS + compressedDistance * ORBIT_DISPLAY_SCALE;
  const value = clamp(rawValue, ORBIT_DISPLAY_INNER_RADIUS, ORBIT_DISPLAY_MAX_RADIUS);
  const clampState =
    value === rawValue ? 'none' : value === ORBIT_DISPLAY_INNER_RADIUS ? 'min' : 'max';

  return {
    value,
    rawValue,
    clampState,
  };
};

export const mapPhysicalOrbitToDisplayRadiusFromAu = (distanceAu: number) =>
  mapPhysicalOrbitToDisplayRadiusFromAuWithMetadata(distanceAu).value;

export const mapPhysicalOrbitToDisplayRadiusFromMeters = (distanceMeters: number) =>
  mapPhysicalOrbitToDisplayRadiusFromAu(distanceMeters / AU_IN_METERS);

export const mapPhysicalOrbitToDisplayRadiusFromMetersWithMetadata = (distanceMeters: number) =>
  mapPhysicalOrbitToDisplayRadiusFromAuWithMetadata(distanceMeters / AU_IN_METERS);
