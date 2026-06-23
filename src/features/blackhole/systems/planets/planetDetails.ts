import * as THREE from 'three';

import type { FriendPlanet, FriendPlanetProfile, PlanetPanelElements } from '@blackhole/types';

import {
  colorToRgba,
  formatPercent,
  getPlanetAppearanceProfile,
  getPlanetColor,
} from './planetAppearance';

export const formatPlanetTemperature = (profile?: FriendPlanetProfile) => {
  const min = profile?.temperature?.min;
  const max = profile?.temperature?.max;
  const unit = profile?.temperature?.unit ?? 'C';

  if (typeof min === 'number' && typeof max === 'number') {
    return `${min} ~ ${max} ${unit}`;
  }

  return 'Unknown';
};

export const formatPlanetAtmosphere = (profile?: FriendPlanetProfile) => {
  if (!profile?.atmosphere?.is_show) {
    return 'None';
  }

  const composition = profile.atmosphere.composition ?? 'Unknown';
  const pressure = profile.atmosphere.pressure;
  const pressureUnit = profile.atmosphere.pressure_unit ?? 'atm';

  if (typeof pressure === 'number') {
    return `${composition} / ${pressure} ${pressureUnit}`;
  }

  return composition;
};

export const formatPlanetOrbit = (profile?: FriendPlanetProfile) => {
  if (!profile?.orbit?.is_show) {
    return 'Hidden';
  }

  const distance = profile.orbit.distance_from_star;
  const distanceUnit = profile.orbit.distance_unit ?? 'AU';
  const period = profile.orbit.period;
  const periodUnit = profile.orbit.period_unit ?? 'days';

  if (typeof distance === 'number' && typeof period === 'number') {
    return `${distance} ${distanceUnit} / ${period} ${periodUnit}`;
  }

  if (typeof distance === 'number') {
    return `${distance} ${distanceUnit}`;
  }

  return 'Unknown';
};

export const formatPlanetWeight = (profile?: FriendPlanetProfile) => {
  const value = profile?.weight?.value;
  const unit = profile?.weight?.unit ?? 'kg';
  const scientificNotation = profile?.weight?.scientific_notation;

  if (typeof value === 'number' && scientificNotation) {
    return `${value} x ${scientificNotation} ${unit}`;
  }

  if (typeof value === 'number') {
    return `${value} ${unit}`;
  }

  return 'Unknown';
};

export const formatPlanetRotation = (profile?: FriendPlanetProfile) => {
  const rotationSpeed = profile?.physics?.rotation_speed;
  const unit = profile?.physics?.rotation_unit ?? 'hours';

  if (typeof rotationSpeed !== 'number') {
    return 'Unknown';
  }

  return `${rotationSpeed} ${unit} / rotation`;
};

export const formatPlanetTilt = (profile?: FriendPlanetProfile) => {
  const tilt = profile?.physics?.axial_tilt;

  if (typeof tilt !== 'number') {
    return '0°';
  }

  return `${tilt}°`;
};

export const formatPlanetPoles = (friend: FriendPlanet) => {
  const appearance = getPlanetAppearanceProfile(friend);

  if (!appearance.poleVisible) {
    return 'Hidden';
  }

  return `${formatPercent(appearance.poleSize)} cap band`;
};

export const formatPlanetEquator = (friend: FriendPlanet) => {
  const appearance = getPlanetAppearanceProfile(friend);

  if (!appearance.equatorVisible) {
    return 'None';
  }

  return `${formatPercent(appearance.equatorWidth)} width / ${formatPercent(appearance.equatorIntensity)} glow`;
};

export const formatPlanetClouds = (friend: FriendPlanet) => {
  const appearance = getPlanetAppearanceProfile(friend);

  if (!appearance.cloudVisible || appearance.cloudOpacity <= 0.01) {
    return 'Clear';
  }

  return `${formatPercent(appearance.cloudCoverage)} cover / ${formatPercent(appearance.cloudOpacity)} opacity`;
};

export const formatPlanetSurface = (friend: FriendPlanet) => {
  const appearance = getPlanetAppearanceProfile(friend);
  const waterSummary = appearance.waterVisible
    ? `water ${formatPercent(appearance.waterCoverage)}`
    : 'dry crust';

  return `${waterSummary} / land ${formatPercent(appearance.landCoverage)}`;
};

export const getPlanetPreviewBackground = (friend: FriendPlanet) => {
  const appearance = getPlanetAppearanceProfile(friend);
  const background = colorToRgba(appearance.shadowColor, 0.96);
  const color = colorToRgba(appearance.baseColor, 0.92);
  const atmosphereGlow = colorToRgba(
    appearance.atmosphereColor,
    0.22 + appearance.atmosphereIntensity * 0.18,
  );

  return `radial-gradient(circle at 72% 28%, rgba(255,255,255,0.26), transparent 24%), radial-gradient(circle at 44% 38%, ${atmosphereGlow}, transparent 26%), linear-gradient(145deg, ${color}, ${background})`;
};

export const applyPlanetPreviewAppearance = (
  elements: PlanetPanelElements,
  friend: FriendPlanet,
) => {
  const appearance = getPlanetAppearanceProfile(friend);
  const axialTilt = friend.planet?.physics?.axial_tilt ?? 0;

  if (elements.previewAtmosphere) {
    elements.previewAtmosphere.style.background = `radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.08 + appearance.atmosphereIntensity * 0.08)}, transparent 58%), radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.18 + appearance.atmosphereIntensity * 0.22)}, transparent 72%)`;
    elements.previewAtmosphere.style.boxShadow = `0 0 28px ${colorToRgba(appearance.atmosphereColor, 0.12 + appearance.atmosphereIntensity * 0.16)}`;
    elements.previewAtmosphere.style.transform = `rotate(${axialTilt * 0.2}deg)`;
  }

  if (elements.previewPlanet) {
    elements.previewPlanet.style.background = `radial-gradient(circle at 34% 24%, ${colorToRgba(appearance.landSecondaryColor, 0.38)}, transparent 26%), linear-gradient(160deg, ${colorToRgba(appearance.baseColor, 1)}, ${colorToRgba(appearance.shadowColor, 1)})`;
    elements.previewPlanet.style.transform = `rotate(${axialTilt * 0.3}deg)`;
  }

  if (elements.previewWater) {
    elements.previewWater.style.background = `radial-gradient(circle at 30% 26%, ${colorToRgba(appearance.waterColor.clone().lerp(new THREE.Color('#ffffff'), appearance.waterGloss * 0.22), 0.84)}, transparent 28%), linear-gradient(150deg, ${colorToRgba(appearance.waterColor, appearance.waterVisible ? 0.94 : 0.2)}, ${colorToRgba(appearance.shadowColor, 0.82)})`;
    elements.previewWater.style.opacity = appearance.waterVisible ? '1' : '0.22';
  }

  if (elements.previewLand) {
    elements.previewLand.style.background = `radial-gradient(circle at 24% 36%, ${colorToRgba(appearance.landSecondaryColor, 0.95)}, transparent 38%), radial-gradient(circle at 72% 68%, ${colorToRgba(appearance.landColor, 0.92)}, transparent 34%), linear-gradient(135deg, ${colorToRgba(appearance.landColor, 0.98)}, ${colorToRgba(appearance.landSecondaryColor, 0.88)})`;
    elements.previewLand.style.opacity = appearance.landCoverage.toFixed(2);
  }

  if (elements.previewClouds) {
    elements.previewClouds.style.background = `radial-gradient(circle at 22% 44%, ${colorToRgba(appearance.cloudColor, 0.92)}, transparent 20%), radial-gradient(circle at 54% 28%, ${colorToRgba(appearance.cloudColor, 0.86)}, transparent 18%), radial-gradient(circle at 76% 64%, ${colorToRgba(appearance.cloudColor, 0.74)}, transparent 17%)`;
    elements.previewClouds.style.opacity = appearance.cloudVisible
      ? appearance.cloudOpacity.toFixed(2)
      : '0';
    elements.previewClouds.style.display = appearance.cloudVisible ? '' : 'none';
  }

  if (elements.previewEquator) {
    elements.previewEquator.style.background = `linear-gradient(90deg, transparent, ${colorToRgba(appearance.equatorColor, 0.28 + appearance.equatorIntensity * 0.42)}, transparent)`;
    elements.previewEquator.style.height = `${Math.max(6, appearance.equatorWidth * 28)}px`;
    elements.previewEquator.style.display = appearance.equatorVisible ? '' : 'none';
  }

  if (elements.previewPoleNorth) {
    elements.previewPoleNorth.style.background = `radial-gradient(circle at 50% 24%, ${colorToRgba(appearance.poleColor, 0.96)}, ${colorToRgba(appearance.poleColor.clone().lerp(appearance.shadowColor, 0.26), 0.52)})`;
    elements.previewPoleNorth.style.width = `${Math.max(18, appearance.poleSize * 84)}px`;
    elements.previewPoleNorth.style.display = appearance.poleVisible ? '' : 'none';
  }

  if (elements.previewPoleSouth) {
    elements.previewPoleSouth.style.background = `radial-gradient(circle at 50% 24%, ${colorToRgba(appearance.poleColor, 0.96)}, ${colorToRgba(appearance.poleColor.clone().lerp(appearance.shadowColor, 0.26), 0.52)})`;
    elements.previewPoleSouth.style.width = `${Math.max(18, appearance.poleSize * 84)}px`;
    elements.previewPoleSouth.style.display = appearance.poleVisible ? '' : 'none';
  }

  if (elements.previewRing) {
    const ringColor = getPlanetColor(friend.planet?.ring?.color, '#d7d1c4');
    elements.previewRing.style.borderColor = colorToRgba(ringColor, 0.46);
    elements.previewRing.style.boxShadow = `0 0 16px ${colorToRgba(ringColor, 0.12)}`;
    elements.previewRing.style.display = friend.planet?.ring?.is_show ? '' : 'none';
  }
};

export const renderPlanetPanel = (elements: PlanetPanelElements, friend: FriendPlanet) => {
  if (!elements.panel) {
    return;
  }

  if (
    elements.panel.dataset.activePlanet === friend.name &&
    !elements.panel.hasAttribute('hidden')
  ) {
    return;
  }

  elements.panel.dataset.activePlanet = friend.name;
  elements.panel.removeAttribute('hidden');

  if (elements.type) {
    elements.type.textContent = `${friend.type} world`;
  }
  if (elements.name) {
    elements.name.textContent = friend.name;
  }
  if (elements.description) {
    elements.description.textContent = friend.description;
  }
  if (elements.statType) {
    elements.statType.textContent = friend.type;
  }
  if (elements.statRadius) {
    elements.statRadius.textContent = `${friend.planet?.radius ?? 'Unknown'} km`;
  }
  if (elements.statTemperature) {
    elements.statTemperature.textContent = formatPlanetTemperature(friend.planet);
  }
  if (elements.statAtmosphere) {
    elements.statAtmosphere.textContent = formatPlanetAtmosphere(friend.planet);
  }
  if (elements.statOrbit) {
    elements.statOrbit.textContent = formatPlanetOrbit(friend.planet);
  }
  if (elements.statWeight) {
    elements.statWeight.textContent = formatPlanetWeight(friend.planet);
  }
  if (elements.statRotation) {
    elements.statRotation.textContent = formatPlanetRotation(friend.planet);
  }
  if (elements.statTilt) {
    elements.statTilt.textContent = formatPlanetTilt(friend.planet);
  }
  if (elements.statPoles) {
    elements.statPoles.textContent = formatPlanetPoles(friend);
  }
  if (elements.statEquator) {
    elements.statEquator.textContent = formatPlanetEquator(friend);
  }
  if (elements.statClouds) {
    elements.statClouds.textContent = formatPlanetClouds(friend);
  }
  if (elements.statSurface) {
    elements.statSurface.textContent = formatPlanetSurface(friend);
  }
  if (elements.preview) {
    elements.preview.style.background = getPlanetPreviewBackground(friend);
  }

  applyPlanetPreviewAppearance(elements, friend);

  if (elements.previewCopy) {
    elements.previewCopy.textContent = `${friend.name} overview`;
  }
  if (elements.link) {
    elements.link.href = friend.url;
  }
};
