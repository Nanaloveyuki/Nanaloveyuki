import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import type { BodyPanelElements } from '@blackhole/types';

import {
  applyBodyPreviewAppearance,
  formatBodyClouds,
  formatBodyEquator,
  formatBodyPoles,
  formatBodySurface,
  getBodyPreviewBackground,
} from './bodyPreview';
import type { BodyDerivedState } from './bodyDerivedState';
import type { BodyEntry } from './bodyTypes';

const ASTRONOMICAL_UNIT_METERS = 149_597_870_700;
const METERS_PER_KILOMETER = 1_000;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

const formatBodyKind = (body: CelestialBody) => body.sourceType ?? body.kind;

const formatBodyCategory = (body: CelestialBody) => {
  switch (body.kind) {
    case 'blackhole':
      return 'singularity';
    case 'star':
      return 'star';
    case 'moon':
      return 'moon';
    case 'asteroid':
      return 'asteroid';
    case 'ring-system':
      return 'ring system';
    case 'planet':
    default:
      return 'planet';
  }
};

const formatKilometers = (value: number) => {
  if (value >= 1000) {
    return Math.round(value).toLocaleString('en-US');
  }

  if (value >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
};

const formatLuminositySolar = (value: number) => {
  if (value >= 1000) {
    return value.toExponential(2);
  }

  if (value >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
};

const formatAu = (value: number) => {
  if (value >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
};

const formatNanometers = (value: number) => {
  if (value >= 1000) {
    return value.toFixed(0);
  }

  if (value >= 100) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
};

const formatDensity = (value: number) => {
  if (value >= 10000) {
    return value.toExponential(2);
  }

  if (value >= 1000) {
    return Math.round(value).toLocaleString('en-US');
  }

  return value.toFixed(1);
};

const formatBodyTemperature = (body: CelestialBody, derivedState: BodyDerivedState) => {
  const min = body.physical?.temperatureKelvinMin;
  const max = body.physical?.temperatureKelvinMax;

  if (typeof min === 'number' && typeof max === 'number') {
    const base = `${Math.round(min)} ~ ${Math.round(max)} K`;

    if (body.kind === 'star' && derivedState.stellarSpectralClass) {
      return `${base} / ${derivedState.stellarSpectralClass} estimate`;
    }

    if (body.kind === 'blackhole') {
      return `${base} / accretion band`;
    }

    return base;
  }

  return 'Unknown';
};

const formatBodyAtmosphere = (body: CelestialBody) => {
  if (body.kind === 'blackhole') {
    return 'Accretion environment';
  }

  if (body.kind === 'asteroid' || body.kind === 'ring-system') {
    return 'None';
  }

  const composition = body.physical?.atmosphereComposition;
  const pressure = body.physical?.atmospherePressure;
  const pressureUnit = body.physical?.atmospherePressureUnit ?? 'atm';

  if (!composition && typeof pressure !== 'number') {
    return 'None';
  }

  if (composition && typeof pressure === 'number') {
    return `${composition} / ${pressure} ${pressureUnit}`;
  }

  return composition ?? `${pressure} ${pressureUnit}`;
};

const formatBodyOrbitDistance = (distanceMeters: number) => {
  if (distanceMeters >= ASTRONOMICAL_UNIT_METERS * 0.1) {
    const valueInAu = distanceMeters / ASTRONOMICAL_UNIT_METERS;
    const precision = valueInAu >= 10 ? 1 : 2;
    return `${valueInAu.toFixed(precision)} AU`;
  }

  return `${Math.round(distanceMeters / METERS_PER_KILOMETER).toLocaleString('en-US')} km`;
};

const formatBodyPeriod = (periodSeconds: number) => {
  if (periodSeconds >= SECONDS_PER_DAY) {
    const days = periodSeconds / SECONDS_PER_DAY;
    return `${days.toFixed(days >= 100 ? 0 : days >= 10 ? 1 : 2)} days`;
  }

  const hours = periodSeconds / SECONDS_PER_HOUR;
  return `${hours.toFixed(hours >= 100 ? 0 : hours >= 10 ? 1 : 2)} hours`;
};

const formatBodyOrbit = (body: CelestialBody, derivedState: BodyDerivedState) => {
  const distance = derivedState.orbitDistanceMeters ?? body.orbit?.distanceFromPrimaryMeters;
  const period = derivedState.orbitPeriodSeconds ?? body.orbit?.periodSeconds;
  const parentLabel = derivedState.orbitParentName
    ? `around ${derivedState.orbitParentName} / `
    : '';

  if (typeof distance === 'number' && typeof period === 'number') {
    const suffix = derivedState.orbitPeriodDerived
      ? derivedState.orbitPrimaryMassSource === 'orbit-primary-mass'
        ? ' estimated from primary mass'
        : derivedState.orbitPrimaryMassSource === 'parent-body-mass'
          ? ' estimated from parent body'
          : ' estimated'
      : '';
    const stabilitySuffix =
      derivedState.orbitStability === 'inside-isco'
        ? ' / inside ISCO'
        : derivedState.orbitStability === 'near-isco'
          ? ' / near ISCO'
          : '';
    return `${parentLabel}${formatBodyOrbitDistance(distance)} / ${formatBodyPeriod(period)}${suffix}${stabilitySuffix}`;
  }

  if (typeof distance === 'number') {
    return `${parentLabel}${formatBodyOrbitDistance(distance)}`;
  }

  return body.orbit?.visible === false ? 'Hidden' : 'Unknown';
};

const formatBodyOrbitParent = (derivedState: BodyDerivedState) => {
  if (derivedState.orbitParentName) {
    return derivedState.orbitParentName;
  }

  if (derivedState.orbitParentId) {
    return `${derivedState.orbitParentId} / unresolved`;
  }

  return 'Root body';
};

const formatBodyOrbitSource = (body: CelestialBody, derivedState: BodyDerivedState) => {
  if (body.orbit?.visible === false) {
    return 'Hidden orbit';
  }

  if (!derivedState.orbitDistanceMeters && !derivedState.orbitPeriodSeconds) {
    return 'No orbit data';
  }

  switch (derivedState.orbitPrimaryMassSource) {
    case 'orbit-primary-mass':
      return derivedState.orbitPeriodDerived ? 'primary_mass derived' : 'primary_mass';
    case 'parent-body-mass':
      return derivedState.orbitPeriodDerived ? 'parent body derived' : 'parent body';
    case 'default-primary-mass':
      return 'default fallback derived';
    default:
      return derivedState.orbitPeriodDerived ? 'derived period' : 'explicit orbit data';
  }
};

const formatBodyHierarchy = (derivedState: BodyDerivedState) => {
  if (!derivedState.orbitParentId) {
    return 'Root / no parent';
  }

  if (derivedState.orbitParentResolved) {
    return `Resolved / child of ${derivedState.orbitParentName ?? derivedState.orbitParentId}`;
  }

  return `Missing parent / ${derivedState.orbitParentId}`;
};

const formatBodyWeight = (body: CelestialBody, derivedState: BodyDerivedState) => {
  const mass = body.physical?.mass;

  const derivedSuffix =
    body.kind === 'star' && typeof derivedState.stellarLuminositySolar === 'number'
      ? ` / ~${formatLuminositySolar(derivedState.stellarLuminositySolar)} L☉`
      : typeof derivedState.surfaceGravity === 'number'
        ? ` / ${derivedState.surfaceGravity.toFixed(2)} m/s²`
        : '';

  if (typeof derivedState.massKilograms === 'number') {
    return `${derivedState.massKilograms.toExponential(3)} kg${derivedSuffix}`;
  }

  if (typeof mass?.value === 'number' && mass.scientificNotation) {
    return `${mass.value} x ${mass.scientificNotation} ${mass.unit ?? 'kg'}${derivedSuffix}`;
  }

  if (typeof mass?.value === 'number') {
    return `${mass.value} ${mass.unit ?? 'kg'}${derivedSuffix}`;
  }

  return 'Unknown';
};

const formatBodyDensity = (derivedState: BodyDerivedState) => {
  if (typeof derivedState.densityKgPerCubicMeter !== 'number') {
    return 'Unknown';
  }

  return `${formatDensity(derivedState.densityKgPerCubicMeter)} kg/m³`;
};

const formatBodyGravity = (derivedState: BodyDerivedState) => {
  if (typeof derivedState.surfaceGravity !== 'number') {
    return 'Unknown';
  }

  return `${derivedState.surfaceGravity.toFixed(2)} m/s²`;
};

const formatSceneUnits = (value: number) => {
  if (value >= 10) {
    return value.toFixed(1);
  }

  if (value >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
};

const formatClampLabel = (value: BodyDerivedState['radiusDisplayClamp']) => {
  switch (value) {
    case 'min':
      return 'clamped min';
    case 'max':
      return 'clamped max';
    case 'none':
      return 'unclamped';
    default:
      return 'unknown';
  }
};

const formatMotionScalar = (value: number) => {
  if (value >= 0.1) {
    return value.toFixed(3);
  }

  if (value >= 0.01) {
    return value.toFixed(4);
  }

  return value.toFixed(5);
};

const formatBodyPhysicsOverview = (body: CelestialBody, derivedState: BodyDerivedState) => {
  if (body.kind === 'blackhole') {
    if (
      typeof derivedState.schwarzschildRadiusKilometers === 'number' &&
      typeof derivedState.blackholeIscoKilometers === 'number'
    ) {
      const diskLabel =
        typeof derivedState.blackholeAccretionDiskTemperatureKelvin === 'number' &&
        derivedState.blackholePeakEmissionBand
          ? ` / disk ~${Math.round(derivedState.blackholeAccretionDiskTemperatureKelvin)} K ${derivedState.blackholePeakEmissionBand}`
          : '';

      return `Rs ${formatKilometers(derivedState.schwarzschildRadiusKilometers)} km / ISCO ${formatKilometers(derivedState.blackholeIscoKilometers)} km${diskLabel}`;
    }

    if (typeof derivedState.schwarzschildRadiusKilometers === 'number') {
      return `Rs ${formatKilometers(derivedState.schwarzschildRadiusKilometers)} km`;
    }

    return 'Singularity model';
  }

  if (body.kind === 'star') {
    const spectralClass = derivedState.stellarSpectralClass;
    const luminosity = derivedState.stellarLuminositySolar;
    const habitableZoneLabel =
      typeof derivedState.habitableZoneInnerAu === 'number' &&
      typeof derivedState.habitableZoneOuterAu === 'number'
        ? ` / HZ ${formatAu(derivedState.habitableZoneInnerAu)}-${formatAu(derivedState.habitableZoneOuterAu)} AU`
        : '';

    if (spectralClass && typeof luminosity === 'number') {
      return `${spectralClass} / ~${formatLuminositySolar(luminosity)} L☉${habitableZoneLabel}`;
    }

    if (spectralClass) {
      return `${spectralClass} estimate`;
    }

    if (typeof luminosity === 'number') {
      return `~${formatLuminositySolar(luminosity)} L☉`;
    }

    return 'Stellar estimate pending';
  }

  if (
    typeof derivedState.densityKgPerCubicMeter === 'number' &&
    typeof derivedState.surfaceGravity === 'number'
  ) {
    return 'Density + gravity derived';
  }

  if (typeof derivedState.densityKgPerCubicMeter === 'number') {
    return 'Density derived';
  }

  if (typeof derivedState.surfaceGravity === 'number') {
    return 'Gravity derived';
  }

  return 'Limited physical data';
};

const formatBodyRadiusMapping = (derivedState: BodyDerivedState) => {
  if (
    typeof derivedState.radiusKilometers !== 'number' ||
    typeof derivedState.radiusDisplay !== 'number'
  ) {
    return 'Unknown';
  }

  const rawLabel =
    typeof derivedState.radiusDisplayRaw === 'number'
      ? ` raw ${formatSceneUnits(derivedState.radiusDisplayRaw)}`
      : '';

  return `${formatKilometers(derivedState.radiusKilometers)} km -> ${formatSceneUnits(derivedState.radiusDisplay)} scene u / ${derivedState.radiusDisplaySource} / ${formatClampLabel(derivedState.radiusDisplayClamp)}${rawLabel}`;
};

const formatBodyOrbitMapping = (derivedState: BodyDerivedState) => {
  if (
    typeof derivedState.orbitDistanceMeters !== 'number' ||
    typeof derivedState.orbitRadiusDisplay !== 'number'
  ) {
    return 'Unknown';
  }

  const realOrbitLabel =
    typeof derivedState.orbitDistanceAu === 'number' && derivedState.orbitDistanceAu >= 0.1
      ? `${derivedState.orbitDistanceAu.toFixed(derivedState.orbitDistanceAu >= 10 ? 1 : 2)} AU`
      : `${Math.round(derivedState.orbitDistanceMeters / METERS_PER_KILOMETER).toLocaleString('en-US')} km`;

  const rawLabel =
    typeof derivedState.orbitRadiusDisplayRaw === 'number'
      ? ` raw ${formatSceneUnits(derivedState.orbitRadiusDisplayRaw)}`
      : '';

  return `${realOrbitLabel} -> ${formatSceneUnits(derivedState.orbitRadiusDisplay)} scene u / ${derivedState.orbitRadiusDisplaySource} / ${formatClampLabel(derivedState.orbitRadiusDisplayClamp)}${rawLabel}`;
};

const formatBodyMotionMapping = (derivedState: BodyDerivedState) => {
  const orbitMotion =
    typeof derivedState.orbitAngularSpeed === 'number'
      ? `orbit ${formatMotionScalar(derivedState.orbitAngularSpeed)}`
      : 'orbit n/a';
  const rotationMotion =
    typeof derivedState.rotationSpeedDisplay === 'number'
      ? `spin ${formatMotionScalar(derivedState.rotationSpeedDisplay)}`
      : 'spin n/a';

  return `${orbitMotion} / ${rotationMotion}`;
};

const formatHabitableZoneStatus = (value: BodyDerivedState['habitableZoneStatus']) => {
  switch (value) {
    case 'inside':
      return 'inside HZ';
    case 'too-hot':
      return 'inside orbit hot side';
    case 'too-cold':
      return 'outside orbit cold side';
    default:
      return null;
  }
};

const formatInputStateLabel = (
  value: BodyDerivedState['inputState'][keyof BodyDerivedState['inputState']],
) => {
  switch (value) {
    case 'body-explicit':
      return 'explicit';
    case 'presentation-fallback':
      return 'fallback';
    case 'derived':
      return 'derived';
    case 'parent-derived':
      return 'parent';
    case 'default-fallback':
      return 'default';
    case 'missing':
    default:
      return 'missing';
  }
};

const formatBodyInputState = (derivedState: BodyDerivedState) => {
  const { inputState } = derivedState;

  return [
    `radius ${formatInputStateLabel(inputState.radius)}`,
    `mass ${formatInputStateLabel(inputState.mass)}`,
    `temp ${formatInputStateLabel(inputState.temperature)}`,
    `atm ${formatInputStateLabel(inputState.atmosphere)}`,
    `orbit ${formatInputStateLabel(inputState.orbitDistance)}`,
    `period ${formatInputStateLabel(inputState.orbitPeriod)}`,
    `primary ${formatInputStateLabel(inputState.orbitPrimaryMass)}`,
    `rotation ${formatInputStateLabel(inputState.rotation)}`,
  ].join(' / ');
};

const formatBodyDerivedState = (body: CelestialBody, derivedState: BodyDerivedState) => {
  const readiness: string[] = [];

  readiness.push(
    derivedState.orbitParentResolved || !derivedState.orbitParentId
      ? 'parent ok'
      : 'parent missing',
  );

  if (body.kind === 'star') {
    readiness.push(derivedState.stellarSpectralClass ? 'spectral ok' : 'spectral missing');
    readiness.push(
      typeof derivedState.stellarLuminositySolar === 'number'
        ? 'luminosity ok'
        : 'luminosity missing',
    );
    readiness.push(derivedState.stellarColor ? 'color ok' : 'color missing');
    readiness.push(
      typeof derivedState.habitableZoneInnerAu === 'number' &&
        typeof derivedState.habitableZoneOuterAu === 'number'
        ? 'hz ok'
        : 'hz missing',
    );
  } else if (body.kind === 'blackhole') {
    readiness.push(
      typeof derivedState.schwarzschildRadiusKilometers === 'number'
        ? 'horizon ok'
        : 'horizon missing',
    );
    readiness.push(
      typeof derivedState.blackholeIscoKilometers === 'number' ? 'isco ok' : 'isco missing',
    );
    readiness.push(
      typeof derivedState.blackholeAccretionDiskTemperatureKelvin === 'number'
        ? 'disk ok'
        : 'disk missing',
    );
  } else {
    readiness.push(
      typeof derivedState.densityKgPerCubicMeter === 'number' ? 'density ok' : 'density missing',
    );
    readiness.push(
      typeof derivedState.surfaceGravity === 'number' ? 'gravity ok' : 'gravity missing',
    );
  }

  const habitableZoneStatus = formatHabitableZoneStatus(derivedState.habitableZoneStatus);
  if (habitableZoneStatus) {
    readiness.push(habitableZoneStatus);
  }

  if (derivedState.orbitStability === 'inside-isco') {
    readiness.push('inside isco');
  } else if (derivedState.orbitStability === 'near-isco') {
    readiness.push('near isco');
  }

  readiness.push(derivedState.orbitPeriodDerived ? 'period derived' : 'period explicit');

  return readiness.join(' / ');
};

const formatBodyRadius = (body: CelestialBody, derivedState: BodyDerivedState) => {
  if (typeof derivedState.radiusKilometers !== 'number') {
    return 'Unknown';
  }

  if (body.kind === 'blackhole') {
    if (typeof derivedState.schwarzschildRadiusKilometers === 'number') {
      const visualRadius = formatKilometers(derivedState.radiusKilometers);
      const horizonRadius = formatKilometers(derivedState.schwarzschildRadiusKilometers);
      const closelyMatchesHorizon =
        Math.abs(derivedState.radiusKilometers - derivedState.schwarzschildRadiusKilometers) /
          Math.max(derivedState.schwarzschildRadiusKilometers, 1) <
        0.05;

      return closelyMatchesHorizon
        ? `${horizonRadius} km horizon`
        : `${visualRadius} km body / Rs ${horizonRadius} km`;
    }

    return `${formatKilometers(derivedState.radiusKilometers)} km horizon`;
  }

  return `${formatKilometers(derivedState.radiusKilometers)} km`;
};

const formatBodyRotation = (derivedState: BodyDerivedState) => {
  const periodSeconds = derivedState.rotationPeriodSeconds;

  if (typeof periodSeconds !== 'number') {
    return 'Unknown';
  }

  return `${formatBodyPeriod(periodSeconds)} / rotation`;
};

const formatBodyTemperatureHeuristic = (derivedState: BodyDerivedState) => {
  if (typeof derivedState.averageTemperatureKelvin !== 'number') {
    return null;
  }

  if (derivedState.stellarColor) {
    return `${Math.round(derivedState.averageTemperatureKelvin)} K / ${derivedState.stellarColor}`;
  }

  return `${Math.round(derivedState.averageTemperatureKelvin)} K`;
};

const formatBodyBlackholeHeuristic = (derivedState: BodyDerivedState) => {
  if (
    typeof derivedState.blackholeAccretionDiskTemperatureKelvin !== 'number' ||
    typeof derivedState.blackholePeakEmissionNanometers !== 'number' ||
    !derivedState.blackholePeakEmissionBand
  ) {
    return null;
  }

  const colorLabel = derivedState.blackholeAccretionDiskColor
    ? ` / ${derivedState.blackholeAccretionDiskColor}`
    : '';

  return `disk ${Math.round(derivedState.blackholeAccretionDiskTemperatureKelvin)} K / peak ${formatNanometers(derivedState.blackholePeakEmissionNanometers)} nm / ${derivedState.blackholePeakEmissionBand}${colorLabel}`;
};

const formatBodyStellarOrbitHeuristic = (derivedState: BodyDerivedState) => {
  if (
    typeof derivedState.habitableZoneInnerAu !== 'number' ||
    typeof derivedState.habitableZoneOuterAu !== 'number'
  ) {
    return null;
  }

  const status = formatHabitableZoneStatus(derivedState.habitableZoneStatus);
  const suffix = status ? ` / ${status}` : '';
  return `HZ ${formatAu(derivedState.habitableZoneInnerAu)}-${formatAu(derivedState.habitableZoneOuterAu)} AU${suffix}`;
};

const formatBodyTilt = (derivedState: BodyDerivedState) => {
  const axialTilt = derivedState.axialTiltDeg;

  if (typeof axialTilt !== 'number') {
    return '0°';
  }

  return `${axialTilt}°`;
};

export const renderBodyPanel = (elements: BodyPanelElements, bodyEntry: BodyEntry) => {
  if (!elements.panel) {
    return;
  }

  const { body, data: friend } = bodyEntry;
  const derivedState = bodyEntry.derivedState;

  if (elements.panel.dataset.activePlanet === body.name && !elements.panel.hasAttribute('hidden')) {
    return;
  }

  elements.panel.dataset.activePlanet = body.name;
  elements.panel.removeAttribute('hidden');

  if (elements.type) {
    elements.type.textContent = `${formatBodyKind(body)} ${formatBodyCategory(body)}`;
  }
  if (elements.name) {
    elements.name.textContent = body.name;
  }
  if (elements.description) {
    elements.description.textContent = body.description ?? friend.description;
  }
  if (elements.statType) {
    elements.statType.textContent = formatBodyKind(body);
  }
  if (elements.statRadius) {
    elements.statRadius.textContent = formatBodyRadius(body, derivedState);
  }
  if (elements.statTemperature) {
    elements.statTemperature.textContent =
      (body.kind === 'star' ? formatBodyTemperatureHeuristic(derivedState) : null) ??
      (body.kind === 'blackhole' ? formatBodyBlackholeHeuristic(derivedState) : null) ??
      formatBodyTemperature(body, derivedState);
  }
  if (elements.statAtmosphere) {
    elements.statAtmosphere.textContent = formatBodyAtmosphere(body);
  }
  if (elements.statOrbit) {
    elements.statOrbit.textContent =
      (body.kind !== 'star' ? formatBodyStellarOrbitHeuristic(derivedState) : null) ??
      formatBodyOrbit(body, derivedState);
  }
  if (elements.statOrbitParent) {
    elements.statOrbitParent.textContent = formatBodyOrbitParent(derivedState);
  }
  if (elements.statOrbitSource) {
    elements.statOrbitSource.textContent = formatBodyOrbitSource(body, derivedState);
  }
  if (elements.statHierarchy) {
    elements.statHierarchy.textContent = formatBodyHierarchy(derivedState);
  }
  if (elements.statWeight) {
    elements.statWeight.textContent = formatBodyWeight(body, derivedState);
  }
  if (elements.statDensity) {
    elements.statDensity.textContent = formatBodyDensity(derivedState);
  }
  if (elements.statGravity) {
    elements.statGravity.textContent = formatBodyGravity(derivedState);
  }
  if (elements.statPhysics) {
    elements.statPhysics.textContent = formatBodyPhysicsOverview(body, derivedState);
  }
  if (elements.statScaleRadius) {
    elements.statScaleRadius.textContent = formatBodyRadiusMapping(derivedState);
  }
  if (elements.statScaleOrbit) {
    elements.statScaleOrbit.textContent = formatBodyOrbitMapping(derivedState);
  }
  if (elements.statScaleMotion) {
    elements.statScaleMotion.textContent = formatBodyMotionMapping(derivedState);
  }
  if (elements.statInputState) {
    elements.statInputState.textContent = formatBodyInputState(derivedState);
  }
  if (elements.statDerivedState) {
    elements.statDerivedState.textContent = formatBodyDerivedState(body, derivedState);
  }
  if (elements.statRotation) {
    elements.statRotation.textContent = formatBodyRotation(derivedState);
  }
  if (elements.statTilt) {
    elements.statTilt.textContent = formatBodyTilt(derivedState);
  }
  if (elements.statPoles) {
    elements.statPoles.textContent = formatBodyPoles(bodyEntry);
  }
  if (elements.statEquator) {
    elements.statEquator.textContent = formatBodyEquator(bodyEntry);
  }
  if (elements.statClouds) {
    elements.statClouds.textContent = formatBodyClouds(bodyEntry);
  }
  if (elements.statSurface) {
    elements.statSurface.textContent = formatBodySurface(bodyEntry);
  }
  if (elements.preview) {
    elements.preview.style.background = getBodyPreviewBackground(bodyEntry);
  }

  applyBodyPreviewAppearance(elements, bodyEntry);

  if (elements.previewCopy) {
    elements.previewCopy.textContent = `${body.name} ${formatBodyCategory(body)} overview`;
  }
  if (elements.link) {
    elements.link.href = body.externalUrl ?? friend.url;
  }
};
