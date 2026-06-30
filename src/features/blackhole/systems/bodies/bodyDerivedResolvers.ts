import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import {
  normalizeDistanceToMeters,
  normalizePeriodToSeconds,
  normalizeTemperatureToKelvin,
} from '@blackhole/simulation/mapping/displayScale';
import { resolveMassKilograms } from '@blackhole/simulation/physics/bodyPhysics';

import type { BodyDefinition, BodyDerivationContext } from './bodyTypes';

export const resolveBodyMassKilograms = (
  body: CelestialBody,
  fallback?: BodyDefinition['presentation'],
) => resolveMassKilograms(body.physical?.mass) ?? resolveMassKilograms(fallback?.profile?.mass);

export const resolveBodyRadiusKilometers = (bodyDefinition: BodyDefinition) => {
  const radiusKilometers = bodyDefinition.body.physical?.radiusKilometers;

  if (
    typeof radiusKilometers === 'number' &&
    Number.isFinite(radiusKilometers) &&
    radiusKilometers > 0
  ) {
    return radiusKilometers;
  }

  const presentationRadius = bodyDefinition.presentation?.profile?.radius;
  if (
    typeof presentationRadius === 'number' &&
    Number.isFinite(presentationRadius) &&
    presentationRadius > 0
  ) {
    return presentationRadius;
  }

  return null;
};

export const resolveOrbitDistanceMeters = (bodyDefinition: BodyDefinition) => {
  const orbitDistance = bodyDefinition.body.orbit?.distanceFromPrimaryMeters;

  if (typeof orbitDistance === 'number' && Number.isFinite(orbitDistance) && orbitDistance > 0) {
    return orbitDistance;
  }

  const presentationOrbit = bodyDefinition.presentation?.profile?.orbit;
  if (
    typeof presentationOrbit?.distanceFromPrimary === 'number' &&
    Number.isFinite(presentationOrbit.distanceFromPrimary) &&
    presentationOrbit.distanceFromPrimary > 0
  ) {
    return normalizeDistanceToMeters(
      presentationOrbit.distanceFromPrimary,
      presentationOrbit.distanceUnit,
    );
  }

  return null;
};

export const resolveOrbitPeriodSeconds = (bodyDefinition: BodyDefinition) => {
  const orbitPeriod = bodyDefinition.body.orbit?.periodSeconds;

  if (typeof orbitPeriod === 'number' && Number.isFinite(orbitPeriod) && orbitPeriod > 0) {
    return orbitPeriod;
  }

  const presentationOrbit = bodyDefinition.presentation?.profile?.orbit;
  if (
    typeof presentationOrbit?.period === 'number' &&
    Number.isFinite(presentationOrbit.period) &&
    presentationOrbit.period > 0
  ) {
    return normalizePeriodToSeconds(presentationOrbit.period, presentationOrbit.periodUnit);
  }

  return null;
};

export const resolveOrbitPrimaryMassKilograms = (bodyDefinition: BodyDefinition) => {
  const orbitPrimaryMass = bodyDefinition.body.orbit?.primaryMass;

  if (orbitPrimaryMass) {
    const resolvedOrbitPrimaryMass = resolveMassKilograms(orbitPrimaryMass);
    if (typeof resolvedOrbitPrimaryMass === 'number') {
      return resolvedOrbitPrimaryMass;
    }
  }

  const presentationPrimaryMass = bodyDefinition.presentation?.profile?.orbit?.primaryMass;
  if (presentationPrimaryMass) {
    const resolvedPresentationPrimaryMass = resolveMassKilograms(presentationPrimaryMass);
    if (typeof resolvedPresentationPrimaryMass === 'number') {
      return resolvedPresentationPrimaryMass;
    }
  }

  return null;
};

export const resolveParentBodyDefinition = (
  bodyDefinition: BodyDefinition,
  context?: BodyDerivationContext,
) => {
  const parentId = bodyDefinition.body.orbit?.parentId;

  if (!parentId || !context?.bodyDefinitionsById) {
    return null;
  }

  return context.bodyDefinitionsById.get(parentId) ?? null;
};

export const resolveParentBodyMassKilograms = (
  bodyDefinition: BodyDefinition,
  context?: BodyDerivationContext,
) => {
  const parentBodyDefinition = resolveParentBodyDefinition(bodyDefinition, context);

  if (!parentBodyDefinition) {
    return null;
  }

  return (
    resolveBodyMassKilograms(parentBodyDefinition.body, parentBodyDefinition.presentation) ?? null
  );
};

export const resolveRotationPeriodSeconds = (bodyDefinition: BodyDefinition) => {
  const rotationPeriod = bodyDefinition.body.rotation?.rotationPeriodSeconds;

  if (typeof rotationPeriod === 'number' && Number.isFinite(rotationPeriod) && rotationPeriod > 0) {
    return rotationPeriod;
  }

  const presentationPhysics = bodyDefinition.presentation?.profile?.physics;
  if (
    typeof presentationPhysics?.rotationPeriod === 'number' &&
    Number.isFinite(presentationPhysics.rotationPeriod) &&
    presentationPhysics.rotationPeriod > 0
  ) {
    return normalizePeriodToSeconds(
      presentationPhysics.rotationPeriod,
      presentationPhysics.rotationUnit,
    );
  }

  return null;
};

export const resolveAxialTiltDeg = (bodyDefinition: BodyDefinition) => {
  const bodyTilt = bodyDefinition.body.rotation?.axialTiltDeg;
  if (typeof bodyTilt === 'number' && Number.isFinite(bodyTilt)) {
    return bodyTilt;
  }

  const presentationTilt = bodyDefinition.presentation?.profile?.physics?.axialTilt;
  if (typeof presentationTilt === 'number' && Number.isFinite(presentationTilt)) {
    return presentationTilt;
  }

  return null;
};

export const resolveAverageTemperatureKelvin = (bodyDefinition: BodyDefinition) => {
  const minimumTemperature = bodyDefinition.body.physical?.temperatureKelvinMin;
  const maximumTemperature = bodyDefinition.body.physical?.temperatureKelvinMax;

  if (typeof minimumTemperature === 'number' && typeof maximumTemperature === 'number') {
    return (minimumTemperature + maximumTemperature) * 0.5;
  }

  if (typeof minimumTemperature === 'number') {
    return minimumTemperature;
  }

  if (typeof maximumTemperature === 'number') {
    return maximumTemperature;
  }

  const presentationTemperature = bodyDefinition.presentation?.profile?.temperature;

  if (
    typeof presentationTemperature?.min === 'number' &&
    typeof presentationTemperature?.max === 'number'
  ) {
    return (
      (normalizeTemperatureToKelvin(presentationTemperature.min, presentationTemperature.unit) +
        normalizeTemperatureToKelvin(presentationTemperature.max, presentationTemperature.unit)) *
      0.5
    );
  }

  if (typeof presentationTemperature?.min === 'number') {
    return normalizeTemperatureToKelvin(presentationTemperature.min, presentationTemperature.unit);
  }

  if (typeof presentationTemperature?.max === 'number') {
    return normalizeTemperatureToKelvin(presentationTemperature.max, presentationTemperature.unit);
  }

  return null;
};
