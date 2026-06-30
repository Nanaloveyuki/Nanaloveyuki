export type CelestialBodyKind =
  | 'blackhole'
  | 'star'
  | 'planet'
  | 'moon'
  | 'asteroid'
  | 'ring-system';

export type CelestialBodyMass = {
  kilograms?: number;
  value?: number;
  unit?: string;
  scientificNotation?: string;
};

export type PhysicalProfile = {
  radiusKilometers?: number;
  temperatureKelvinMin?: number;
  temperatureKelvinMax?: number;
  mass?: CelestialBodyMass;
  atmospherePressure?: number;
  atmospherePressureUnit?: string;
  atmosphereComposition?: string;
};

export type RotationProfile = {
  axialTiltDeg?: number;
  rotationPeriodSeconds?: number;
};

export type OrbitalElements = {
  distanceFromPrimaryMeters?: number;
  periodSeconds?: number;
  parentId?: string;
  primaryMass?: CelestialBodyMass;
  visible?: boolean;
};

export type AppearanceProfile = {
  template?: string;
  baseColor?: string;
  background?: string;
  hasAtmosphere?: boolean;
  hasClouds?: boolean;
  hasRings?: boolean;
};

export type CelestialBody = {
  id: string;
  name: string;
  kind: CelestialBodyKind;
  sourceType?: string;
  description?: string;
  externalUrl?: string;
  physical?: PhysicalProfile;
  rotation?: RotationProfile;
  orbit?: OrbitalElements;
  appearance?: AppearanceProfile;
};
