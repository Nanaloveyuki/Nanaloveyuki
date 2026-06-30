import { clamp } from '@blackhole/math';
import {
  AU_IN_METERS,
  mapPhysicalOrbitToDisplayRadiusFromMetersWithMetadata,
  SECONDS_PER_DAY,
} from '@blackhole/simulation/mapping/displayScale';
import {
  calculateInnermostStableCircularOrbitKilometers,
  classifyHabitableZoneStatus,
  classifyOrbitStabilityAgainstIsco,
  estimateHabitableZoneAu,
  estimateOrbitPeriodSeconds,
} from '@blackhole/simulation/physics/bodyPhysics';

import type { BodyDefinition, BodyDerivationContext } from './bodyTypes';
import { deriveStellarState } from './bodyStellarDerivation';
import {
  resolveOrbitDistanceMeters,
  resolveOrbitPeriodSeconds,
  resolveOrbitPrimaryMassKilograms,
  resolveParentBodyDefinition,
  resolveParentBodyMassKilograms,
} from './bodyDerivedResolvers';

export type BodyOrbitDerivedState = {
  orbitDistanceMeters: number | null;
  orbitDistanceAu: number | null;
  orbitRadiusDisplay: number | null;
  orbitRadiusDisplayRaw: number | null;
  orbitRadiusDisplaySource: 'physical-map' | 'missing';
  orbitRadiusDisplayClamp: 'none' | 'min' | 'max' | null;
  orbitParentId: string | null;
  orbitParentName: string | null;
  orbitParentResolved: boolean;
  orbitPrimaryMassKilograms: number | null;
  orbitPrimaryMassExplicit: boolean;
  orbitPrimaryMassSource: 'orbit-primary-mass' | 'parent-body-mass' | 'default-primary-mass' | null;
  orbitPeriodSeconds: number | null;
  orbitPeriodDerived: boolean;
  orbitAngularSpeed: number | null;
  orbitStability: 'inside-isco' | 'near-isco' | 'stable' | null;
  habitableZoneInnerAu: number | null;
  habitableZoneOuterAu: number | null;
  habitableZoneStatus: 'inside' | 'too-hot' | 'too-cold' | null;
  inputState: {
    orbitDistance: 'body-explicit' | 'presentation-fallback' | 'missing';
    orbitPeriod: 'body-explicit' | 'presentation-fallback' | 'derived' | 'missing';
    orbitParent: 'body-explicit' | 'presentation-fallback' | 'missing';
    orbitPrimaryMass:
      | 'body-explicit'
      | 'presentation-fallback'
      | 'parent-derived'
      | 'default-fallback'
      | 'missing';
  };
};

export const deriveOrbitState = (
  bodyDefinition: BodyDefinition,
  context: BodyDerivationContext | undefined,
) => {
  const orbitDistanceMeters = resolveOrbitDistanceMeters(bodyDefinition);
  const explicitOrbitPrimaryMassKilograms = resolveOrbitPrimaryMassKilograms(bodyDefinition);
  const parentBodyDefinition = resolveParentBodyDefinition(bodyDefinition, context);
  const parentBodyMassKilograms = resolveParentBodyMassKilograms(bodyDefinition, context);
  const orbitPrimaryMassKilograms =
    explicitOrbitPrimaryMassKilograms ?? parentBodyMassKilograms ?? null;
  const explicitOrbitPeriodSeconds = resolveOrbitPeriodSeconds(bodyDefinition);
  const orbitPrimaryMassSource =
    typeof explicitOrbitPrimaryMassKilograms === 'number'
      ? 'orbit-primary-mass'
      : typeof parentBodyMassKilograms === 'number'
        ? 'parent-body-mass'
        : typeof orbitDistanceMeters === 'number' && explicitOrbitPeriodSeconds === null
          ? 'default-primary-mass'
          : null;

  const derivedOrbitPeriodSeconds =
    explicitOrbitPeriodSeconds ??
    (typeof orbitDistanceMeters === 'number' && orbitDistanceMeters > 0
      ? estimateOrbitPeriodSeconds(orbitDistanceMeters, orbitPrimaryMassKilograms ?? undefined)
      : null);

  const parentStellarState =
    parentBodyDefinition?.body.kind === 'star' ? deriveStellarState(parentBodyDefinition) : null;
  const habitableZone =
    typeof parentStellarState?.stellarLuminositySolar === 'number'
      ? estimateHabitableZoneAu(parentStellarState.stellarLuminositySolar)
      : null;
  const habitableZoneStatus =
    habitableZone && typeof orbitDistanceMeters === 'number'
      ? classifyHabitableZoneStatus(
          orbitDistanceMeters / AU_IN_METERS,
          habitableZone.innerAu,
          habitableZone.outerAu,
        )
      : null;
  const orbitStability =
    typeof orbitDistanceMeters === 'number' &&
    parentBodyDefinition?.body.kind === 'blackhole' &&
    typeof parentBodyMassKilograms === 'number'
      ? classifyOrbitStabilityAgainstIsco(
          orbitDistanceMeters,
          calculateInnermostStableCircularOrbitKilometers(parentBodyMassKilograms) ?? NaN,
        )
      : null;

  const orbitDisplayMapping =
    typeof orbitDistanceMeters === 'number'
      ? mapPhysicalOrbitToDisplayRadiusFromMetersWithMetadata(orbitDistanceMeters)
      : null;

  return {
    orbitState: {
      orbitDistanceMeters,
      orbitDistanceAu:
        typeof orbitDistanceMeters === 'number' ? orbitDistanceMeters / AU_IN_METERS : null,
      orbitRadiusDisplay: orbitDisplayMapping?.value ?? null,
      orbitRadiusDisplayRaw: orbitDisplayMapping?.rawValue ?? null,
      orbitRadiusDisplaySource: orbitDisplayMapping ? 'physical-map' : 'missing',
      orbitRadiusDisplayClamp: orbitDisplayMapping?.clampState ?? null,
      orbitParentId: bodyDefinition.body.orbit?.parentId ?? null,
      orbitParentName: parentBodyDefinition?.body.name ?? null,
      orbitParentResolved: parentBodyDefinition !== null,
      orbitPrimaryMassKilograms,
      orbitPrimaryMassExplicit: typeof explicitOrbitPrimaryMassKilograms === 'number',
      orbitPrimaryMassSource,
      orbitPeriodSeconds: derivedOrbitPeriodSeconds,
      orbitPeriodDerived:
        explicitOrbitPeriodSeconds === null && typeof derivedOrbitPeriodSeconds === 'number',
      orbitAngularSpeed:
        typeof derivedOrbitPeriodSeconds === 'number' && derivedOrbitPeriodSeconds > 0
          ? clamp(
              0.012 *
                Math.pow(365 / clamp(derivedOrbitPeriodSeconds / SECONDS_PER_DAY, 40, 5000), 0.34),
              0.0032,
              0.0135,
            )
          : null,
      orbitStability,
      habitableZoneInnerAu: habitableZone?.innerAu ?? null,
      habitableZoneOuterAu: habitableZone?.outerAu ?? null,
      habitableZoneStatus,
      inputState: {
        orbitDistance:
          typeof bodyDefinition.body.orbit?.distanceFromPrimaryMeters === 'number'
            ? 'body-explicit'
            : typeof bodyDefinition.presentation?.profile?.orbit?.distanceFromPrimary === 'number'
              ? 'presentation-fallback'
              : 'missing',
        orbitPeriod:
          typeof bodyDefinition.body.orbit?.periodSeconds === 'number'
            ? 'body-explicit'
            : typeof bodyDefinition.presentation?.profile?.orbit?.period === 'number'
              ? 'presentation-fallback'
              : typeof derivedOrbitPeriodSeconds === 'number'
                ? 'derived'
                : 'missing',
        orbitParent: bodyDefinition.body.orbit?.parentId
          ? 'body-explicit'
          : bodyDefinition.presentation?.profile?.orbit?.parentId
            ? 'presentation-fallback'
            : 'missing',
        orbitPrimaryMass: bodyDefinition.body.orbit?.primaryMass
          ? 'body-explicit'
          : bodyDefinition.presentation?.profile?.orbit?.primaryMass
            ? 'presentation-fallback'
            : typeof parentBodyMassKilograms === 'number'
              ? 'parent-derived'
              : typeof orbitDistanceMeters === 'number' && explicitOrbitPeriodSeconds === null
                ? 'default-fallback'
                : 'missing',
      },
    } satisfies BodyOrbitDerivedState,
    parentBodyDefinition,
    parentBodyMassKilograms,
  };
};
