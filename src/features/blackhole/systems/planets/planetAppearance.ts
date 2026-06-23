import * as THREE from 'three';

import { clamp } from '@blackhole/math';
import type { FriendPlanet, FriendPlanetProfile, FriendPlanetType } from '@blackhole/types';

export const getPlanetColor = (value: string | undefined, fallback: string | THREE.Color) => {
  const color = fallback instanceof THREE.Color ? fallback.clone() : new THREE.Color(fallback);

  if (!value) {
    return color;
  }

  try {
    color.set(value);
  } catch {
    color.set(fallback);
  }

  return color;
};

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

export const colorToRgba = (color: THREE.Color, alpha: number) => {
  const normalizedAlpha = clamp(alpha, 0, 1);
  const r = Math.round(clamp(color.r, 0, 1) * 255);
  const g = Math.round(clamp(color.g, 0, 1) * 255);
  const b = Math.round(clamp(color.b, 0, 1) * 255);

  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
};

export const formatPercent = (value: number) => `${Math.round(clamp(value, 0, 1) * 100)}%`;

export const getPlanetAppearanceProfile = (friend: FriendPlanet) => {
  const defaults: Record<
    FriendPlanetType,
    {
      surfaceBase: string;
      surfaceShadow: string;
      water: string;
      land: string;
      landSecondary: string;
      clouds: string;
      atmosphere: string;
      poles: string;
      equator: string;
      waterVisible: boolean;
    }
  > = {
    cold: {
      surfaceBase: '#d8ecff',
      surfaceShadow: '#173252',
      water: '#91cbff',
      land: '#b8d7f2',
      landSecondary: '#eef8ff',
      clouds: '#f6fbff',
      atmosphere: '#d7efff',
      poles: '#ffffff',
      equator: '#d6ebff',
      waterVisible: true,
    },
    cool: {
      surfaceBase: '#cd8c5d',
      surfaceShadow: '#30160f',
      water: '#6ca0c9',
      land: '#93573c',
      landSecondary: '#e0b182',
      clouds: '#fff1e1',
      atmosphere: '#ffd4a6',
      poles: '#fff4e8',
      equator: '#f0bb8a',
      waterVisible: false,
    },
    warm: {
      surfaceBase: '#5f8fe5',
      surfaceShadow: '#102040',
      water: '#86bcff',
      land: '#446cab',
      landSecondary: '#a8c6ff',
      clouds: '#f3f7ff',
      atmosphere: '#a9d0ff',
      poles: '#dde9ff',
      equator: '#9dc1ff',
      waterVisible: true,
    },
    hot: {
      surfaceBase: '#ff9158',
      surfaceShadow: '#280904',
      water: '#ac6550',
      land: '#bf3f21',
      landSecondary: '#ffd06a',
      clouds: '#ffe7cf',
      atmosphere: '#ffb172',
      poles: '#ffe6c7',
      equator: '#ffb26b',
      waterVisible: false,
    },
  };

  const palette = defaults[friend.type];
  const profile = friend.planet;
  const appearance = profile?.appearance;
  const surface = appearance?.surface;
  const water = appearance?.water;
  const land = appearance?.land;
  const clouds = appearance?.clouds;
  const atmosphereVisual = appearance?.atmosphere_visual;
  const poles = appearance?.poles;
  const equator = appearance?.equator;

  const baseColor = getPlanetColor(surface?.base_color ?? profile?.color, palette.surfaceBase);
  const shadowColor = getPlanetColor(
    surface?.shadow_color ?? profile?.background,
    palette.surfaceShadow,
  );
  const waterVisible = water?.is_show ?? palette.waterVisible;
  const waterColor = getPlanetColor(
    water?.color,
    baseColor.clone().lerp(new THREE.Color(palette.water), 0.64),
  );
  const landColor = getPlanetColor(
    land?.color,
    baseColor.clone().lerp(new THREE.Color(palette.land), 0.56),
  );
  const landSecondaryColor = getPlanetColor(
    land?.secondary_color,
    landColor.clone().lerp(new THREE.Color(palette.landSecondary), 0.42),
  );
  const cloudVisible = clouds?.is_show ?? profile?.atmosphere?.is_show ?? waterVisible;
  const cloudColor = getPlanetColor(clouds?.color, palette.clouds);
  const atmosphereVisible = atmosphereVisual?.is_show ?? profile?.atmosphere?.is_show ?? false;
  const atmosphereColor = getPlanetColor(atmosphereVisual?.color, palette.atmosphere);
  const poleVisible = poles?.is_show ?? friend.type !== 'hot';
  const poleColor = getPlanetColor(poles?.color, palette.poles);
  const equatorVisible = equator?.is_show ?? true;
  const equatorColor = getPlanetColor(equator?.color, palette.equator);

  return {
    baseColor,
    shadowColor,
    waterVisible,
    waterColor,
    waterCoverage: clamp(water?.coverage ?? 0.44, 0.05, 0.92),
    waterGloss: clamp(water?.gloss ?? 0.72, 0, 1),
    landColor,
    landSecondaryColor,
    landCoverage: clamp(land?.coverage ?? 0.58, 0.08, 0.96),
    terrainScale: clamp(surface?.terrain_scale ?? 6.4, 2, 18),
    terrainContrast: clamp(surface?.terrain_contrast ?? 0.42, 0.05, 0.95),
    cloudVisible,
    cloudColor,
    cloudOpacity: clamp(clouds?.opacity ?? 0.28, 0, 0.9),
    cloudCoverage: clamp(clouds?.coverage ?? 0.46, 0.08, 0.96),
    cloudSpeed: clamp(clouds?.speed ?? 0.18, 0, 1.5),
    atmosphereVisible,
    atmosphereColor,
    atmosphereIntensity: clamp(atmosphereVisual?.intensity ?? 0.56, 0, 1),
    atmosphereRimPower: clamp(atmosphereVisual?.rim_power ?? 2.8, 1.2, 6),
    poleVisible,
    poleColor,
    poleSize: clamp(poles?.size ?? 0.16, 0.03, 0.42),
    equatorVisible,
    equatorColor,
    equatorWidth: clamp(equator?.width ?? 0.08, 0.02, 0.24),
    equatorIntensity: clamp(equator?.intensity ?? 0.32, 0, 1),
  };
};
