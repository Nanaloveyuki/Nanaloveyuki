import type { CelestialBodyMass } from '@blackhole/domain/celestialTypes';

export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export const SPEED_OF_LIGHT_METERS_PER_SECOND = 299_792_458;
export const SOLAR_MASS_KILOGRAMS = 1.98847e30;
export const DEFAULT_PRIMARY_MASS_KILOGRAMS = 4.1e6 * SOLAR_MASS_KILOGRAMS;
export const WIEN_DISPLACEMENT_NANOMETER_KELVIN = 2.897771955e6;

type MassProfileLike = CelestialBodyMass & {
  scientific_notation?: string;
};

export const parseScientificNotation = (notation: string | undefined) => {
  if (!notation) {
    return null;
  }

  const normalized = notation.replace(/\s+/g, '');
  const exponentMatch = normalized.match(/^10\*\*(-?\d+)$/i) ?? normalized.match(/^1e(-?\d+)$/i);

  if (!exponentMatch) {
    return null;
  }

  const exponent = Number(exponentMatch[1]);
  return Number.isFinite(exponent) ? 10 ** exponent : null;
};

export const resolveMassKilograms = (mass: MassProfileLike | undefined) => {
  if (typeof mass?.kilograms === 'number' && Number.isFinite(mass.kilograms)) {
    return mass.kilograms;
  }

  if (typeof mass?.value !== 'number' || !Number.isFinite(mass.value)) {
    return null;
  }

  const exponent = parseScientificNotation(mass.scientificNotation ?? mass.scientific_notation);
  if (exponent !== null) {
    return mass.value * exponent;
  }

  if ((mass.unit ?? 'kg').toLowerCase() === 'kg') {
    return mass.value;
  }

  return null;
};

export const estimateOrbitPeriodSeconds = (
  orbitDistanceMeters: number,
  primaryMassKilograms: number = DEFAULT_PRIMARY_MASS_KILOGRAMS,
) => {
  if (
    !Number.isFinite(orbitDistanceMeters) ||
    orbitDistanceMeters <= 0 ||
    !Number.isFinite(primaryMassKilograms) ||
    primaryMassKilograms <= 0
  ) {
    return null;
  }

  return (
    2 *
    Math.PI *
    Math.sqrt(orbitDistanceMeters ** 3 / (GRAVITATIONAL_CONSTANT * primaryMassKilograms))
  );
};

export const calculateDensityKgPerCubicMeter = (massKilograms: number, radiusMeters: number) => {
  if (
    !Number.isFinite(massKilograms) ||
    massKilograms <= 0 ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return null;
  }

  return massKilograms / ((4 / 3) * Math.PI * radiusMeters ** 3);
};

export const calculateSurfaceGravityMetersPerSecondSquared = (
  massKilograms: number,
  radiusMeters: number,
) => {
  if (
    !Number.isFinite(massKilograms) ||
    massKilograms <= 0 ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return null;
  }

  return (GRAVITATIONAL_CONSTANT * massKilograms) / radiusMeters ** 2;
};

export const calculateSchwarzschildRadiusKilometers = (massKilograms: number) => {
  if (!Number.isFinite(massKilograms) || massKilograms <= 0) {
    return null;
  }

  return (
    (2 * GRAVITATIONAL_CONSTANT * massKilograms) / SPEED_OF_LIGHT_METERS_PER_SECOND ** 2 / 1000
  );
};

export const estimateStellarLuminositySolar = (massKilograms: number) => {
  if (!Number.isFinite(massKilograms) || massKilograms <= 0) {
    return null;
  }

  const solarMassRatio = massKilograms / SOLAR_MASS_KILOGRAMS;

  if (solarMassRatio < 0.43) {
    return 0.23 * solarMassRatio ** 2.3;
  }

  if (solarMassRatio < 2) {
    return solarMassRatio ** 4;
  }

  if (solarMassRatio < 20) {
    return 1.4 * solarMassRatio ** 3.5;
  }

  return 32_000 * solarMassRatio;
};

export const estimateStellarSpectralClass = (temperatureKelvin: number) => {
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    return null;
  }

  if (temperatureKelvin >= 30_000) {
    return 'O-type';
  }
  if (temperatureKelvin >= 10_000) {
    return 'B-type';
  }
  if (temperatureKelvin >= 7_500) {
    return 'A-type';
  }
  if (temperatureKelvin >= 6_000) {
    return 'F-type';
  }
  if (temperatureKelvin >= 5_200) {
    return 'G-type';
  }
  if (temperatureKelvin >= 3_700) {
    return 'K-type';
  }

  return 'M-type';
};

const toHexComponent = (value: number) =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');

export const estimateBlackbodyColorHex = (temperatureKelvin: number) => {
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    return null;
  }

  const normalizedTemperature = Math.min(400, Math.max(10, temperatureKelvin / 100));
  let red = 255;
  let green = 0;
  let blue = 0;

  if (normalizedTemperature <= 66) {
    green = 99.4708025861 * Math.log(normalizedTemperature) - 161.1195681661;
  } else {
    red = 329.698727446 * Math.pow(normalizedTemperature - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(normalizedTemperature - 60, -0.0755148492);
  }

  if (normalizedTemperature >= 66) {
    blue = 255;
  } else if (normalizedTemperature <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(normalizedTemperature - 10) - 305.0447927307;
  }

  return `#${toHexComponent(red)}${toHexComponent(green)}${toHexComponent(blue)}`;
};

export const estimateHabitableZoneAu = (luminositySolar: number) => {
  if (!Number.isFinite(luminositySolar) || luminositySolar <= 0) {
    return null;
  }

  return {
    innerAu: Math.sqrt(luminositySolar / 1.1),
    outerAu: Math.sqrt(luminositySolar / 0.53),
  };
};

export const classifyHabitableZoneStatus = (
  orbitDistanceAu: number,
  innerAu: number,
  outerAu: number,
) => {
  if (
    !Number.isFinite(orbitDistanceAu) ||
    orbitDistanceAu <= 0 ||
    !Number.isFinite(innerAu) ||
    innerAu <= 0 ||
    !Number.isFinite(outerAu) ||
    outerAu <= 0 ||
    innerAu >= outerAu
  ) {
    return null;
  }

  if (orbitDistanceAu < innerAu) {
    return 'too-hot' as const;
  }

  if (orbitDistanceAu > outerAu) {
    return 'too-cold' as const;
  }

  return 'inside' as const;
};

export const calculateInnermostStableCircularOrbitKilometers = (massKilograms: number) => {
  const schwarzschildRadiusKilometers = calculateSchwarzschildRadiusKilometers(massKilograms);

  if (typeof schwarzschildRadiusKilometers !== 'number') {
    return null;
  }

  return schwarzschildRadiusKilometers * 3;
};

export const estimateBlackholeAccretionDiskTemperatureKelvin = (massKilograms: number) => {
  if (!Number.isFinite(massKilograms) || massKilograms <= 0) {
    return null;
  }

  const solarMassRatio = massKilograms / SOLAR_MASS_KILOGRAMS;
  const normalizedMassRatio = Math.max(solarMassRatio, 0.1);

  return Math.min(3e7, Math.max(4_500, 1.6e7 * Math.pow(normalizedMassRatio / 10, -0.25)));
};

export const estimatePeakEmissionWavelengthNanometers = (temperatureKelvin: number) => {
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    return null;
  }

  return WIEN_DISPLACEMENT_NANOMETER_KELVIN / temperatureKelvin;
};

export const classifyPeakEmissionBand = (wavelengthNanometers: number) => {
  if (!Number.isFinite(wavelengthNanometers) || wavelengthNanometers <= 0) {
    return null;
  }

  if (wavelengthNanometers < 10) {
    return 'x-ray';
  }

  if (wavelengthNanometers < 100) {
    return 'extreme-uv';
  }

  if (wavelengthNanometers < 380) {
    return 'ultraviolet';
  }

  if (wavelengthNanometers <= 750) {
    return 'visible';
  }

  return 'infrared';
};

export const classifyOrbitStabilityAgainstIsco = (
  orbitDistanceMeters: number,
  iscoKilometers: number,
) => {
  if (
    !Number.isFinite(orbitDistanceMeters) ||
    orbitDistanceMeters <= 0 ||
    !Number.isFinite(iscoKilometers) ||
    iscoKilometers <= 0
  ) {
    return null;
  }

  const orbitDistanceKilometers = orbitDistanceMeters / 1000;
  const distanceRatio = orbitDistanceKilometers / iscoKilometers;

  if (distanceRatio < 1) {
    return 'inside-isco' as const;
  }

  if (distanceRatio < 3) {
    return 'near-isco' as const;
  }

  return 'stable' as const;
};
