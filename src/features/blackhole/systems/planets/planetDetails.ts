import type {
  FriendPlanetProfile,
  LegacyFriendPlanet,
  LegacyPlanetPanelElements,
} from '@blackhole/types';

import {
  applyBodyPreviewAppearance,
  formatBodyClouds,
  formatBodyEquator,
  formatBodyPoles,
  formatBodySurface,
  getBodyPreviewBackground,
} from '../bodies/bodyPreview';
import { renderBodyPanel } from '../bodies/bodyDetails';

import { createLegacyFriendPlanetPanelEntry } from './legacyPlanetPanelEntry';

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

export const formatPlanetPoles = (legacyFriend: LegacyFriendPlanet) =>
  formatBodyPoles(createLegacyFriendPlanetPanelEntry(legacyFriend));

export const formatPlanetEquator = (legacyFriend: LegacyFriendPlanet) =>
  formatBodyEquator(createLegacyFriendPlanetPanelEntry(legacyFriend));

export const formatPlanetClouds = (legacyFriend: LegacyFriendPlanet) =>
  formatBodyClouds(createLegacyFriendPlanetPanelEntry(legacyFriend));

export const formatPlanetSurface = (legacyFriend: LegacyFriendPlanet) =>
  formatBodySurface(createLegacyFriendPlanetPanelEntry(legacyFriend));

export const getPlanetPreviewBackground = (legacyFriend: LegacyFriendPlanet) =>
  getBodyPreviewBackground(createLegacyFriendPlanetPanelEntry(legacyFriend));

export const applyPlanetPreviewAppearance = (
  elements: LegacyPlanetPanelElements,
  legacyFriend: LegacyFriendPlanet,
) => applyBodyPreviewAppearance(elements, createLegacyFriendPlanetPanelEntry(legacyFriend));

export const renderPlanetPanel = (
  elements: LegacyPlanetPanelElements,
  legacyFriend: LegacyFriendPlanet,
) => renderBodyPanel(elements, createLegacyFriendPlanetPanelEntry(legacyFriend));
