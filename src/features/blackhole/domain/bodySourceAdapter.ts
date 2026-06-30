import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import {
  normalizeDistanceToMeters,
  normalizePeriodToSeconds,
  normalizeTemperatureToKelvin,
  SECONDS_PER_HOUR,
} from '@blackhole/simulation/mapping/displayScale';
import type { BodySource, BodySourceProfile, LegacyFriendPlanet } from '@blackhole/types';

const normalizeRotationPeriodSeconds = (
  value: number | undefined,
  unit: 'hours' | 'days' | 'seconds' | undefined,
) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  if (unit === 'seconds') {
    return value;
  }

  if (unit === 'days') {
    return normalizePeriodToSeconds(value, 'days');
  }

  return value * SECONDS_PER_HOUR;
};

export const resolveBodySourceProfile = (source: BodySource): BodySourceProfile | undefined =>
  source.body ??
  (source.planet
    ? {
        width: source.planet.width,
        height: source.planet.height,
        radius: source.planet.radius,
        color: source.planet.color,
        background: source.planet.background,
        ring: source.planet.ring,
        temperature: source.planet.temperature,
        atmosphere: source.planet.atmosphere,
        orbit: source.planet.orbit,
        mass: source.planet.weight
          ? {
              value: source.planet.weight.value,
              unit: source.planet.weight.unit,
              scientific_notation: source.planet.weight.scientific_notation,
            }
          : undefined,
        appearance: source.planet.appearance,
        physics: source.planet.physics
          ? {
              rotation_period: source.planet.physics.rotation_speed,
              rotation_unit: source.planet.physics.rotation_unit,
              axial_tilt: source.planet.physics.axial_tilt,
            }
          : undefined,
      }
    : undefined);

export const adaptBodySourceToCelestialBody = (source: BodySource): CelestialBody => {
  const profile = resolveBodySourceProfile(source);
  const orbit = profile?.orbit;
  const temperature = profile?.temperature;
  const mass = profile?.mass;
  const atmosphere = profile?.atmosphere;
  const physics = profile?.physics;
  const appearance = profile?.appearance;

  return {
    id: source.id ?? source.url ?? source.name,
    name: source.name,
    kind: source.kind ?? 'planet',
    sourceType: source.type,
    description: source.description,
    externalUrl: source.url,
    physical: {
      radiusKilometers: profile?.radius,
      temperatureKelvinMin:
        typeof temperature?.min === 'number'
          ? normalizeTemperatureToKelvin(temperature.min, temperature.unit)
          : undefined,
      temperatureKelvinMax:
        typeof temperature?.max === 'number'
          ? normalizeTemperatureToKelvin(temperature.max, temperature.unit)
          : undefined,
      mass: mass
        ? {
            value: mass.value,
            unit: mass.unit,
            scientificNotation: mass.scientific_notation,
          }
        : undefined,
      atmospherePressure: atmosphere?.pressure,
      atmospherePressureUnit: atmosphere?.pressure_unit,
      atmosphereComposition: atmosphere?.composition,
    },
    rotation: {
      axialTiltDeg: physics?.axial_tilt,
      rotationPeriodSeconds: normalizeRotationPeriodSeconds(
        physics?.rotation_period,
        physics?.rotation_unit,
      ),
    },
    orbit: {
      distanceFromPrimaryMeters:
        typeof orbit?.distance_from_star === 'number' &&
        Number.isFinite(orbit.distance_from_star) &&
        orbit.distance_from_star > 0
          ? normalizeDistanceToMeters(orbit.distance_from_star, orbit.distance_unit)
          : undefined,
      periodSeconds:
        typeof orbit?.period === 'number' && Number.isFinite(orbit.period) && orbit.period > 0
          ? normalizePeriodToSeconds(orbit.period, orbit.period_unit)
          : undefined,
      parentId: orbit?.parent_id,
      primaryMass: orbit?.primary_mass
        ? {
            value: orbit.primary_mass.value,
            unit: orbit.primary_mass.unit,
            scientificNotation: orbit.primary_mass.scientific_notation,
          }
        : undefined,
      visible: orbit?.is_show,
    },
    appearance: {
      template: appearance?.template,
      baseColor: profile?.color,
      background: profile?.background,
      hasAtmosphere: appearance?.atmosphere_visual?.is_show ?? atmosphere?.is_show,
      hasClouds: appearance?.clouds?.is_show,
      hasRings: profile?.ring?.is_show,
    },
  };
};

export const adaptLegacyFriendPlanetToBodySource = (
  legacyFriend: LegacyFriendPlanet,
): BodySource => ({
  id: legacyFriend.id,
  name: legacyFriend.name,
  url: legacyFriend.url,
  kind: legacyFriend.kind,
  type: legacyFriend.type,
  description: legacyFriend.description,
  body: legacyFriend.body ?? resolveBodySourceProfile(legacyFriend),
  planet: legacyFriend.planet,
});

export const adaptLegacyFriendPlanetsToBodySources = (
  legacyFriends: LegacyFriendPlanet[],
): BodySource[] => legacyFriends.map(adaptLegacyFriendPlanetToBodySource);
