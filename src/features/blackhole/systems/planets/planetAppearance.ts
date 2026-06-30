import type { FriendPlanetProfile, LegacyFriendPlanet } from '@blackhole/types';

import {
  colorToRgba,
  formatBodyPercent,
  getBodyAppearanceProfile,
  getBodyColor,
} from '../bodies/bodyAppearance';
import { adaptLegacyFriendPlanetToBodyPresentationSource } from '../bodies/bodyPresentation';

export const getPlanetColor = getBodyColor;

export const getPlanetTemperatureBand = (profile?: FriendPlanetProfile) => {
  const min = profile?.temperature?.min;
  const max = profile?.temperature?.max;
  const unit = profile?.temperature?.unit ?? 'C';

  if (typeof min !== 'number' || typeof max !== 'number') {
    return null;
  }

  const minKelvin = unit === 'K' ? min : min + 273.15;
  const maxKelvin = unit === 'K' ? max : max + 273.15;

  return {
    minKelvin,
    maxKelvin,
    averageKelvin: (minKelvin + maxKelvin) * 0.5,
  };
};

export { colorToRgba };

export const formatPercent = formatBodyPercent;

export const getPlanetAppearanceProfile = (legacyFriend: LegacyFriendPlanet) =>
  getBodyAppearanceProfile(adaptLegacyFriendPlanetToBodyPresentationSource(legacyFriend));
