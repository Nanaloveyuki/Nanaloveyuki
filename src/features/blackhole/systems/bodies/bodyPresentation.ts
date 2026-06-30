import type { CelestialBody, CelestialBodyKind } from '@blackhole/domain/celestialTypes';
import { AU_IN_METERS, SECONDS_PER_DAY } from '@blackhole/simulation/mapping/displayScale';
import type { BodySource, LegacyFriendPlanet } from '@blackhole/types';

import { resolveBodySourceProfile } from '@blackhole/domain/bodySourceAdapter';

export type BodyPresentationType = 'cool' | 'cold' | 'warm' | 'hot';

export type BodyPresentationRingProfile = {
  visible?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  color?: string;
};

export type BodyPresentationTemperatureProfile = {
  min?: number;
  max?: number;
  unit?: string;
};

export type BodyPresentationAtmosphereProfile = {
  visible?: boolean;
  composition?: string;
  pressure?: number;
  pressureUnit?: string;
};

export type BodyPresentationOrbitProfile = {
  visible?: boolean;
  distanceFromPrimary?: number;
  distanceUnit?: string;
  period?: number;
  periodUnit?: string;
  parentId?: string;
  primaryMass?: BodyPresentationMassProfile;
};

export type BodyPresentationMassProfile = {
  value?: number;
  unit?: string;
  scientificNotation?: string;
};

export type BodyPresentationSurfaceAppearance = {
  baseColor?: string;
  shadowColor?: string;
  terrainScale?: number;
  terrainContrast?: number;
};

export type BodyPresentationWaterAppearance = {
  visible?: boolean;
  color?: string;
  coverage?: number;
  gloss?: number;
};

export type BodyPresentationLandAppearance = {
  color?: string;
  secondaryColor?: string;
  coverage?: number;
};

export type BodyPresentationCloudAppearance = {
  visible?: boolean;
  color?: string;
  opacity?: number;
  coverage?: number;
  speed?: number;
};

export type BodyPresentationAtmosphereVisualProfile = {
  visible?: boolean;
  color?: string;
  intensity?: number;
  rimPower?: number;
};

export type BodyPresentationPolarAppearance = {
  visible?: boolean;
  color?: string;
  size?: number;
};

export type BodyPresentationEquatorAppearance = {
  visible?: boolean;
  color?: string;
  width?: number;
  intensity?: number;
};

export type BodyPresentationAppearanceProfile = {
  template?: string;
  surface?: BodyPresentationSurfaceAppearance;
  water?: BodyPresentationWaterAppearance;
  land?: BodyPresentationLandAppearance;
  clouds?: BodyPresentationCloudAppearance;
  atmosphereVisual?: BodyPresentationAtmosphereVisualProfile;
  poles?: BodyPresentationPolarAppearance;
  equator?: BodyPresentationEquatorAppearance;
};

export type BodyPresentationPhysicsProfile = {
  rotationPeriod?: number;
  rotationUnit?: 'hours' | 'days' | 'seconds';
  axialTilt?: number;
};

export type BodyPresentationProfile = {
  width?: number;
  height?: number;
  radius?: number;
  color?: string;
  background?: string;
  ring?: BodyPresentationRingProfile;
  temperature?: BodyPresentationTemperatureProfile;
  atmosphere?: BodyPresentationAtmosphereProfile;
  orbit?: BodyPresentationOrbitProfile;
  mass?: BodyPresentationMassProfile;
  appearance?: BodyPresentationAppearanceProfile;
  physics?: BodyPresentationPhysicsProfile;
};

export type BodyPresentationSource = {
  name: string;
  url: string;
  kind: CelestialBodyKind;
  type: BodyPresentationType;
  description: string;
  profile?: BodyPresentationProfile;
};

const inferPresentationType = (body: CelestialBody): BodyPresentationType => {
  const averageKelvin =
    typeof body.physical?.temperatureKelvinMin === 'number' &&
    typeof body.physical?.temperatureKelvinMax === 'number'
      ? (body.physical.temperatureKelvinMin + body.physical.temperatureKelvinMax) * 0.5
      : undefined;

  if (typeof averageKelvin === 'number') {
    if (averageKelvin >= 900) {
      return 'hot';
    }
    if (averageKelvin >= 340) {
      return 'warm';
    }
    if (averageKelvin <= 180) {
      return 'cold';
    }
  }

  return 'cool';
};

const toOrbitDistance = (distanceMeters: number) => {
  if (distanceMeters >= AU_IN_METERS * 0.05) {
    return {
      distanceFromPrimary: Number((distanceMeters / AU_IN_METERS).toFixed(4)),
      distanceUnit: 'AU',
    } as const;
  }

  return {
    distanceFromPrimary: Number((distanceMeters / 1000).toFixed(0)),
    distanceUnit: 'km',
  } as const;
};

const toRotationProfile = (body: CelestialBody): BodyPresentationPhysicsProfile | undefined => {
  const axialTilt = body.rotation?.axialTiltDeg;
  const rotationPeriodSeconds = body.rotation?.rotationPeriodSeconds;

  if (typeof axialTilt !== 'number' && typeof rotationPeriodSeconds !== 'number') {
    return undefined;
  }

  return {
    axialTilt,
    rotationPeriod:
      typeof rotationPeriodSeconds === 'number'
        ? Number((rotationPeriodSeconds / 3600).toFixed(3))
        : undefined,
    rotationUnit: typeof rotationPeriodSeconds === 'number' ? 'hours' : undefined,
  };
};

const toTemperatureProfile = (
  body: CelestialBody,
): BodyPresentationTemperatureProfile | undefined => {
  if (
    typeof body.physical?.temperatureKelvinMin !== 'number' &&
    typeof body.physical?.temperatureKelvinMax !== 'number'
  ) {
    return undefined;
  }

  return {
    min:
      typeof body.physical?.temperatureKelvinMin === 'number'
        ? Number(body.physical.temperatureKelvinMin.toFixed(0))
        : undefined,
    max:
      typeof body.physical?.temperatureKelvinMax === 'number'
        ? Number(body.physical.temperatureKelvinMax.toFixed(0))
        : undefined,
    unit: 'K',
  };
};

const toAtmosphereProfile = (
  body: CelestialBody,
): BodyPresentationAtmosphereProfile | undefined => {
  const composition = body.physical?.atmosphereComposition;
  const pressure = body.physical?.atmospherePressure;

  if (!composition && typeof pressure !== 'number' && body.appearance?.hasAtmosphere !== true) {
    return undefined;
  }

  return {
    visible: body.appearance?.hasAtmosphere ?? true,
    composition,
    pressure,
    pressureUnit: body.physical?.atmospherePressureUnit,
  };
};

const toOrbitProfile = (body: CelestialBody): BodyPresentationOrbitProfile | undefined => {
  const distanceMeters = body.orbit?.distanceFromPrimaryMeters;
  const periodSeconds = body.orbit?.periodSeconds;

  if (
    typeof distanceMeters !== 'number' &&
    typeof periodSeconds !== 'number' &&
    body.orbit?.visible !== false
  ) {
    return undefined;
  }

  return {
    visible: body.orbit?.visible,
    ...(typeof distanceMeters === 'number' ? toOrbitDistance(distanceMeters) : {}),
    period:
      typeof periodSeconds === 'number'
        ? Number((periodSeconds / SECONDS_PER_DAY).toFixed(3))
        : undefined,
    periodUnit: typeof periodSeconds === 'number' ? 'days' : undefined,
    parentId: body.orbit?.parentId,
    primaryMass: body.orbit?.primaryMass
      ? {
          value: body.orbit.primaryMass.value,
          unit: body.orbit.primaryMass.unit,
          scientificNotation: body.orbit.primaryMass.scientificNotation,
        }
      : undefined,
  };
};

const toMassProfile = (body: CelestialBody): BodyPresentationMassProfile | undefined => {
  const mass = body.physical?.mass;

  if (!mass) {
    return undefined;
  }

  return {
    value: mass.value,
    unit: mass.unit,
    scientificNotation: mass.scientificNotation,
  };
};

const toAppearanceProfile = (
  body: CelestialBody,
): BodyPresentationAppearanceProfile | undefined => {
  if (!body.appearance) {
    return undefined;
  }

  return {
    template: body.appearance.template,
    atmosphereVisual: body.appearance.hasAtmosphere
      ? {
          visible: true,
        }
      : undefined,
    clouds:
      typeof body.appearance.hasClouds === 'boolean'
        ? {
            visible: body.appearance.hasClouds,
          }
        : undefined,
  };
};

const toRingProfile = (body: CelestialBody): BodyPresentationRingProfile | undefined => {
  if (!body.appearance?.hasRings) {
    return undefined;
  }

  return {
    visible: true,
  };
};

export const adaptBodySourceToBodyPresentationSource = (
  source: BodySource,
): BodyPresentationSource => {
  const profile = resolveBodySourceProfile(source);

  return {
    name: source.name,
    url: source.url,
    kind: source.kind ?? 'planet',
    type: source.type,
    description: source.description,
    profile: profile
      ? {
          width: profile.width,
          height: profile.height,
          radius: profile.radius,
          color: profile.color,
          background: profile.background,
          ring: profile.ring
            ? {
                visible: profile.ring.is_show,
                innerRadius: profile.ring.inner_radius,
                outerRadius: profile.ring.outer_radius,
                color: profile.ring.color,
              }
            : undefined,
          temperature: profile.temperature
            ? {
                min: profile.temperature.min,
                max: profile.temperature.max,
                unit: profile.temperature.unit,
              }
            : undefined,
          atmosphere: profile.atmosphere
            ? {
                visible: profile.atmosphere.is_show,
                composition: profile.atmosphere.composition,
                pressure: profile.atmosphere.pressure,
                pressureUnit: profile.atmosphere.pressure_unit,
              }
            : undefined,
          orbit: profile.orbit
            ? {
                visible: profile.orbit.is_show,
                distanceFromPrimary: profile.orbit.distance_from_star,
                distanceUnit: profile.orbit.distance_unit,
                period: profile.orbit.period,
                periodUnit: profile.orbit.period_unit,
                parentId: profile.orbit.parent_id,
                primaryMass: profile.orbit.primary_mass
                  ? {
                      value: profile.orbit.primary_mass.value,
                      unit: profile.orbit.primary_mass.unit,
                      scientificNotation: profile.orbit.primary_mass.scientific_notation,
                    }
                  : undefined,
              }
            : undefined,
          mass: profile.mass
            ? {
                value: profile.mass.value,
                unit: profile.mass.unit,
                scientificNotation: profile.mass.scientific_notation,
              }
            : undefined,
          appearance: profile.appearance
            ? {
                template: profile.appearance.template,
                surface: profile.appearance.surface
                  ? {
                      baseColor: profile.appearance.surface.base_color,
                      shadowColor: profile.appearance.surface.shadow_color,
                      terrainScale: profile.appearance.surface.terrain_scale,
                      terrainContrast: profile.appearance.surface.terrain_contrast,
                    }
                  : undefined,
                water: profile.appearance.water
                  ? {
                      visible: profile.appearance.water.is_show,
                      color: profile.appearance.water.color,
                      coverage: profile.appearance.water.coverage,
                      gloss: profile.appearance.water.gloss,
                    }
                  : undefined,
                land: profile.appearance.land
                  ? {
                      color: profile.appearance.land.color,
                      secondaryColor: profile.appearance.land.secondary_color,
                      coverage: profile.appearance.land.coverage,
                    }
                  : undefined,
                clouds: profile.appearance.clouds
                  ? {
                      visible: profile.appearance.clouds.is_show,
                      color: profile.appearance.clouds.color,
                      opacity: profile.appearance.clouds.opacity,
                      coverage: profile.appearance.clouds.coverage,
                      speed: profile.appearance.clouds.speed,
                    }
                  : undefined,
                atmosphereVisual: profile.appearance.atmosphere_visual
                  ? {
                      visible: profile.appearance.atmosphere_visual.is_show,
                      color: profile.appearance.atmosphere_visual.color,
                      intensity: profile.appearance.atmosphere_visual.intensity,
                      rimPower: profile.appearance.atmosphere_visual.rim_power,
                    }
                  : undefined,
                poles: profile.appearance.poles
                  ? {
                      visible: profile.appearance.poles.is_show,
                      color: profile.appearance.poles.color,
                      size: profile.appearance.poles.size,
                    }
                  : undefined,
                equator: profile.appearance.equator
                  ? {
                      visible: profile.appearance.equator.is_show,
                      color: profile.appearance.equator.color,
                      width: profile.appearance.equator.width,
                      intensity: profile.appearance.equator.intensity,
                    }
                  : undefined,
              }
            : undefined,
          physics: profile.physics
            ? {
                rotationPeriod: profile.physics.rotation_period,
                rotationUnit: profile.physics.rotation_unit,
                axialTilt: profile.physics.axial_tilt,
              }
            : undefined,
        }
      : undefined,
  };
};

export const adaptLegacyFriendPlanetToBodyPresentationSource = (legacyFriend: LegacyFriendPlanet) =>
  adaptBodySourceToBodyPresentationSource({
    name: legacyFriend.name,
    url: legacyFriend.url,
    kind: legacyFriend.kind,
    type: legacyFriend.type,
    description: legacyFriend.description,
    body: legacyFriend.body,
    planet: legacyFriend.planet,
  });

export const createFallbackBodyPresentationSource = (
  body: CelestialBody,
): BodyPresentationSource => ({
  name: body.name,
  url: body.externalUrl ?? '',
  kind: body.kind,
  type: inferPresentationType(body),
  description: body.description ?? `${body.kind} body`,
  profile: {
    radius:
      typeof body.physical?.radiusKilometers === 'number'
        ? Number(body.physical.radiusKilometers.toFixed(0))
        : undefined,
    color: body.appearance?.baseColor,
    background: body.appearance?.background,
    ring: toRingProfile(body),
    temperature: toTemperatureProfile(body),
    atmosphere: toAtmosphereProfile(body),
    orbit: toOrbitProfile(body),
    mass: toMassProfile(body),
    appearance: toAppearanceProfile(body),
    physics: toRotationProfile(body),
  },
});
