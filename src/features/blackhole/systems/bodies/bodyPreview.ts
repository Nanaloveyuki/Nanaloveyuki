import * as THREE from 'three';

import type { BodyPanelElements } from '@blackhole/types';

import {
  colorToRgba,
  formatBodyPercent,
  getBodyAppearanceProfile,
  getBodyColor,
} from './bodyAppearance';
import type { BodyEntry } from './bodyTypes';

export const formatBodyPoles = (bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);

  if (!appearance.poleVisible) {
    return 'Hidden';
  }

  return `${formatBodyPercent(appearance.poleSize)} cap band`;
};

export const formatBodyEquator = (bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);

  if (!appearance.equatorVisible) {
    return 'None';
  }

  return `${formatBodyPercent(appearance.equatorWidth)} width / ${formatBodyPercent(appearance.equatorIntensity)} glow`;
};

export const formatBodyClouds = (bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);

  if (!appearance.cloudVisible || appearance.cloudOpacity <= 0.01) {
    return 'Clear';
  }

  return `${formatBodyPercent(appearance.cloudCoverage)} cover / ${formatBodyPercent(appearance.cloudOpacity)} opacity`;
};

export const formatBodySurface = (bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);
  const waterSummary = appearance.waterVisible
    ? `water ${formatBodyPercent(appearance.waterCoverage)}`
    : 'dry crust';

  return `${waterSummary} / land ${formatBodyPercent(appearance.landCoverage)}`;
};

export const getBodyPreviewBackground = (bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);
  const background = colorToRgba(appearance.shadowColor, 0.96);
  const color = colorToRgba(appearance.baseColor, 0.92);
  const atmosphereGlow = colorToRgba(
    appearance.atmosphereColor,
    0.22 + appearance.atmosphereIntensity * 0.18,
  );

  if (bodyEntry.body.kind === 'blackhole') {
    return `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.98) 0%, rgba(8,4,18,0.96) 22%, ${atmosphereGlow} 42%, rgba(255,154,77,0.22) 56%, ${background} 100%)`;
  }

  if (bodyEntry.body.kind === 'star') {
    return `radial-gradient(circle at 42% 38%, rgba(255,255,255,0.52), transparent 24%), radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.34)}, transparent 54%), linear-gradient(145deg, ${colorToRgba(appearance.baseColor, 0.98)}, ${background})`;
  }

  return `radial-gradient(circle at 72% 28%, rgba(255,255,255,0.26), transparent 24%), radial-gradient(circle at 44% 38%, ${atmosphereGlow}, transparent 26%), linear-gradient(145deg, ${color}, ${background})`;
};

export const applyBodyPreviewAppearance = (elements: BodyPanelElements, bodyEntry: BodyEntry) => {
  const appearance = getBodyAppearanceProfile(bodyEntry.data);
  const axialTilt =
    bodyEntry.body.rotation?.axialTiltDeg ?? bodyEntry.data.profile?.physics?.axialTilt ?? 0;

  if (elements.previewAtmosphere) {
    elements.previewAtmosphere.style.background = `radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.08 + appearance.atmosphereIntensity * 0.08)}, transparent 58%), radial-gradient(circle at 50% 50%, ${colorToRgba(appearance.atmosphereColor, 0.18 + appearance.atmosphereIntensity * 0.22)}, transparent 72%)`;
    elements.previewAtmosphere.style.boxShadow = `0 0 28px ${colorToRgba(appearance.atmosphereColor, 0.12 + appearance.atmosphereIntensity * 0.16)}`;
    elements.previewAtmosphere.style.transform = `rotate(${axialTilt * 0.2}deg)`;
    elements.previewAtmosphere.style.opacity =
      bodyEntry.body.kind === 'asteroid'
        ? '0.2'
        : bodyEntry.body.kind === 'blackhole'
          ? '0.92'
          : '1';
  }

  if (elements.previewPlanet) {
    elements.previewPlanet.style.background =
      bodyEntry.body.kind === 'blackhole'
        ? `radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 0%, rgba(9,4,18,0.98) 42%, ${colorToRgba(appearance.atmosphereColor, 0.42)} 68%, ${colorToRgba(appearance.equatorColor, 0.18)} 100%)`
        : bodyEntry.body.kind === 'star'
          ? `radial-gradient(circle at 38% 28%, rgba(255,255,255,0.62), transparent 22%), radial-gradient(circle at 52% 52%, ${colorToRgba(appearance.landSecondaryColor, 0.34)}, transparent 52%), linear-gradient(160deg, ${colorToRgba(appearance.baseColor, 1)}, ${colorToRgba(appearance.shadowColor, 1)})`
          : `radial-gradient(circle at 34% 24%, ${colorToRgba(appearance.landSecondaryColor, 0.38)}, transparent 26%), linear-gradient(160deg, ${colorToRgba(appearance.baseColor, 1)}, ${colorToRgba(appearance.shadowColor, 1)})`;
    elements.previewPlanet.style.transform = `rotate(${axialTilt * 0.3}deg)`;
  }

  if (elements.previewWater) {
    elements.previewWater.style.background = `radial-gradient(circle at 30% 26%, ${colorToRgba(appearance.waterColor.clone().lerp(new THREE.Color('#ffffff'), appearance.waterGloss * 0.22), 0.84)}, transparent 28%), linear-gradient(150deg, ${colorToRgba(appearance.waterColor, appearance.waterVisible ? 0.94 : 0.2)}, ${colorToRgba(appearance.shadowColor, 0.82)})`;
    elements.previewWater.style.opacity = appearance.waterVisible ? '1' : '0.22';
    elements.previewWater.style.display =
      bodyEntry.body.kind === 'star' || bodyEntry.body.kind === 'blackhole' ? 'none' : '';
  }

  if (elements.previewLand) {
    elements.previewLand.style.background = `radial-gradient(circle at 24% 36%, ${colorToRgba(appearance.landSecondaryColor, 0.95)}, transparent 38%), radial-gradient(circle at 72% 68%, ${colorToRgba(appearance.landColor, 0.92)}, transparent 34%), linear-gradient(135deg, ${colorToRgba(appearance.landColor, 0.98)}, ${colorToRgba(appearance.landSecondaryColor, 0.88)})`;
    elements.previewLand.style.opacity =
      bodyEntry.body.kind === 'blackhole'
        ? '0.34'
        : bodyEntry.body.kind === 'star'
          ? '0.78'
          : appearance.landCoverage.toFixed(2);
  }

  if (elements.previewClouds) {
    elements.previewClouds.style.background = `radial-gradient(circle at 22% 44%, ${colorToRgba(appearance.cloudColor, 0.92)}, transparent 20%), radial-gradient(circle at 54% 28%, ${colorToRgba(appearance.cloudColor, 0.86)}, transparent 18%), radial-gradient(circle at 76% 64%, ${colorToRgba(appearance.cloudColor, 0.74)}, transparent 17%)`;
    elements.previewClouds.style.opacity = appearance.cloudVisible
      ? appearance.cloudOpacity.toFixed(2)
      : '0';
    elements.previewClouds.style.display =
      appearance.cloudVisible &&
      bodyEntry.body.kind !== 'moon' &&
      bodyEntry.body.kind !== 'asteroid'
        ? ''
        : 'none';
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
    const ringColor = getBodyColor(bodyEntry.data.profile?.ring?.color, '#d7d1c4');
    elements.previewRing.style.borderColor = colorToRgba(ringColor, 0.46);
    elements.previewRing.style.boxShadow = `0 0 16px ${colorToRgba(ringColor, 0.12)}`;
    elements.previewRing.style.display =
      bodyEntry.body.kind === 'blackhole'
        ? 'none'
        : bodyEntry.data.profile?.ring?.visible
          ? ''
          : 'none';
  }
};
