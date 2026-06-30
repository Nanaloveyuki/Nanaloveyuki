import * as THREE from 'three';

import { clamp } from '@blackhole/math';
import {
  mapPhysicalRadiusToDisplayRadiusWithMetadata,
  type DisplayClampState,
} from '@blackhole/simulation/mapping/displayScale';
import {
  calculateDensityKgPerCubicMeter,
  calculateSurfaceGravityMetersPerSecondSquared,
} from '@blackhole/simulation/physics/bodyPhysics';

import type { BodyDefinition, BodyDerivationContext } from './bodyTypes';
import {
  resolveAverageTemperatureKelvin,
  resolveAxialTiltDeg,
  resolveBodyMassKilograms,
  resolveBodyRadiusKilometers,
  resolveRotationPeriodSeconds,
} from './bodyDerivedResolvers';
import { deriveBlackholeState } from './bodyBlackholeDerivation';
import { deriveOrbitState } from './bodyOrbitDerivation';
import { deriveStellarState } from './bodyStellarDerivation';

export type BodyDerivedState = {
  radiusKilometers: number | null;
  radiusDisplay: number | null;
  radiusDisplayRaw: number | null;
  radiusDisplaySource: 'physical-map' | 'missing';
  radiusDisplayClamp: DisplayClampState | null;
  averageTemperatureKelvin: number | null;
  orbitDistanceMeters: number | null;
  orbitDistanceAu: number | null;
  orbitRadiusDisplay: number | null;
  orbitRadiusDisplayRaw: number | null;
  orbitRadiusDisplaySource: 'physical-map' | 'missing';
  orbitRadiusDisplayClamp: DisplayClampState | null;
  orbitParentId: string | null;
  orbitParentName: string | null;
  orbitParentResolved: boolean;
  orbitPrimaryMassKilograms: number | null;
  orbitPrimaryMassExplicit: boolean;
  orbitPrimaryMassSource: 'orbit-primary-mass' | 'parent-body-mass' | 'default-primary-mass' | null;
  orbitPeriodSeconds: number | null;
  orbitPeriodDerived: boolean;
  orbitAngularSpeed: number | null;
  rotationPeriodSeconds: number | null;
  rotationSpeedDisplay: number | null;
  axialTiltDeg: number | null;
  axialTiltRadians: number;
  massKilograms: number | null;
  densityKgPerCubicMeter: number | null;
  surfaceGravity: number | null;
  schwarzschildRadiusKilometers: number | null;
  blackholeIscoKilometers: number | null;
  blackholeAccretionDiskTemperatureKelvin: number | null;
  blackholeAccretionDiskColor: string | null;
  blackholePeakEmissionNanometers: number | null;
  blackholePeakEmissionBand: 'x-ray' | 'extreme-uv' | 'ultraviolet' | 'visible' | 'infrared' | null;
  orbitStability: 'inside-isco' | 'near-isco' | 'stable' | null;
  stellarLuminositySolar: number | null;
  stellarSpectralClass: string | null;
  stellarColor: string | null;
  habitableZoneInnerAu: number | null;
  habitableZoneOuterAu: number | null;
  habitableZoneStatus: 'inside' | 'too-hot' | 'too-cold' | null;
  inputState: {
    radius: 'body-explicit' | 'presentation-fallback' | 'missing';
    mass: 'body-explicit' | 'presentation-fallback' | 'missing';
    temperature: 'body-explicit' | 'presentation-fallback' | 'missing';
    atmosphere: 'body-explicit' | 'presentation-fallback' | 'missing';
    orbitDistance: 'body-explicit' | 'presentation-fallback' | 'missing';
    orbitPeriod: 'body-explicit' | 'presentation-fallback' | 'derived' | 'missing';
    orbitParent: 'body-explicit' | 'presentation-fallback' | 'missing';
    orbitPrimaryMass:
      | 'body-explicit'
      | 'presentation-fallback'
      | 'parent-derived'
      | 'default-fallback'
      | 'missing';
    rotation: 'body-explicit' | 'presentation-fallback' | 'missing';
    axialTilt: 'body-explicit' | 'presentation-fallback' | 'missing';
  };
};

export const deriveBodyState = (
  bodyDefinition: BodyDefinition,
  context?: BodyDerivationContext,
): BodyDerivedState => {
  const radiusKilometers = resolveBodyRadiusKilometers(bodyDefinition);
  const rotationPeriodSeconds = resolveRotationPeriodSeconds(bodyDefinition);
  const axialTiltDeg = resolveAxialTiltDeg(bodyDefinition);
  const massKilograms = resolveBodyMassKilograms(bodyDefinition.body, bodyDefinition.presentation);
  const averageTemperatureKelvin = resolveAverageTemperatureKelvin(bodyDefinition);
  const { orbitState } = deriveOrbitState(bodyDefinition, context);
  const stellarState = deriveStellarState(bodyDefinition);
  const blackholeState = deriveBlackholeState(bodyDefinition);

  const radiusMeters = typeof radiusKilometers === 'number' ? radiusKilometers * 1000 : null;
  const densityKgPerCubicMeter =
    typeof massKilograms === 'number' && typeof radiusMeters === 'number'
      ? calculateDensityKgPerCubicMeter(massKilograms, radiusMeters)
      : null;
  const surfaceGravity =
    typeof massKilograms === 'number' && typeof radiusMeters === 'number'
      ? calculateSurfaceGravityMetersPerSecondSquared(massKilograms, radiusMeters)
      : null;
  const inputState = {
    radius:
      typeof bodyDefinition.body.physical?.radiusKilometers === 'number'
        ? 'body-explicit'
        : typeof bodyDefinition.presentation?.profile?.radius === 'number'
          ? 'presentation-fallback'
          : 'missing',
    mass: stellarState.inputState.mass,
    temperature: stellarState.inputState.temperature,
    atmosphere:
      typeof bodyDefinition.body.physical?.atmospherePressure === 'number' ||
      typeof bodyDefinition.body.physical?.atmosphereComposition === 'string'
        ? 'body-explicit'
        : bodyDefinition.presentation?.profile?.atmosphere
          ? 'presentation-fallback'
          : 'missing',
    orbitDistance: orbitState.inputState.orbitDistance,
    orbitPeriod: orbitState.inputState.orbitPeriod,
    orbitParent: orbitState.inputState.orbitParent,
    orbitPrimaryMass: orbitState.inputState.orbitPrimaryMass,
    rotation:
      typeof bodyDefinition.body.rotation?.rotationPeriodSeconds === 'number'
        ? 'body-explicit'
        : typeof bodyDefinition.presentation?.profile?.physics?.rotationPeriod === 'number'
          ? 'presentation-fallback'
          : 'missing',
    axialTilt:
      typeof bodyDefinition.body.rotation?.axialTiltDeg === 'number'
        ? 'body-explicit'
        : typeof bodyDefinition.presentation?.profile?.physics?.axialTilt === 'number'
          ? 'presentation-fallback'
          : 'missing',
  } as const;

  const radiusDisplayMapping =
    typeof radiusKilometers === 'number'
      ? mapPhysicalRadiusToDisplayRadiusWithMetadata(radiusKilometers)
      : null;
  return {
    radiusKilometers,
    radiusDisplay: radiusDisplayMapping?.value ?? null,
    radiusDisplayRaw: radiusDisplayMapping?.rawValue ?? null,
    radiusDisplaySource: radiusDisplayMapping ? 'physical-map' : 'missing',
    radiusDisplayClamp: radiusDisplayMapping?.clampState ?? null,
    averageTemperatureKelvin,
    ...orbitState,
    rotationPeriodSeconds,
    rotationSpeedDisplay:
      typeof rotationPeriodSeconds === 'number' && rotationPeriodSeconds > 0
        ? clamp(((Math.PI * 2) / rotationPeriodSeconds) * 1200, 0.02, 0.45)
        : null,
    axialTiltDeg,
    axialTiltRadians:
      typeof axialTiltDeg === 'number' ? THREE.MathUtils.degToRad(clamp(axialTiltDeg, -65, 65)) : 0,
    massKilograms,
    densityKgPerCubicMeter,
    surfaceGravity,
    ...blackholeState,
    stellarLuminositySolar: stellarState.stellarLuminositySolar,
    stellarSpectralClass: stellarState.stellarSpectralClass,
    stellarColor: stellarState.stellarColor,
    habitableZoneInnerAu: orbitState.habitableZoneInnerAu,
    habitableZoneOuterAu: orbitState.habitableZoneOuterAu,
    habitableZoneStatus: orbitState.habitableZoneStatus,
    inputState,
  };
};

export const getBodyRadius = (
  bodyDefinition: BodyDefinition,
  fallbackRadius: number,
  context?: BodyDerivationContext,
) => deriveBodyState(bodyDefinition, context).radiusDisplay ?? fallbackRadius;

export const getBodyOrbitRadius = (
  bodyDefinition: BodyDefinition,
  fallbackOrbitRadius: number,
  context?: BodyDerivationContext,
) => deriveBodyState(bodyDefinition, context).orbitRadiusDisplay ?? fallbackOrbitRadius;

export const getBodyOrbitSpeed = (
  bodyDefinition: BodyDefinition,
  fallbackOrbitSpeed: number,
  context?: BodyDerivationContext,
) => deriveBodyState(bodyDefinition, context).orbitAngularSpeed ?? fallbackOrbitSpeed;

export const getBodyRotationSpeed = (
  bodyDefinition: BodyDefinition,
  fallbackRotationSpeed: number,
  context?: BodyDerivationContext,
) => deriveBodyState(bodyDefinition, context).rotationSpeedDisplay ?? fallbackRotationSpeed;

export const getBodyAxialTilt = (bodyDefinition: BodyDefinition, context?: BodyDerivationContext) =>
  deriveBodyState(bodyDefinition, context).axialTiltRadians;
