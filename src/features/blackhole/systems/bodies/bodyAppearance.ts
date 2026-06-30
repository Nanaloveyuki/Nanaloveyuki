import * as THREE from 'three';

import { clamp } from '@blackhole/math';
import {
  estimateBlackbodyColorHex,
  estimateBlackholeAccretionDiskTemperatureKelvin,
  resolveMassKilograms,
} from '@blackhole/simulation/physics/bodyPhysics';

import type {
  BodyPresentationProfile,
  BodyPresentationSource,
  BodyPresentationType,
} from './bodyPresentation';

export const getBodyColor = (value: string | undefined, fallback: string | THREE.Color) => {
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

export const getBodyTemperatureBand = (profile?: BodyPresentationProfile) => {
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

export const formatBodyPercent = (value: number) => `${Math.round(clamp(value, 0, 1) * 100)}%`;

export const getBodyAppearanceProfile = (presentation: BodyPresentationSource) => {
  const appearanceTemplatePresets = {
    'flag-mtf': {
      surface: {
        base_color: '#f7f9ff',
        shadow_color: '#273154',
        terrain_scale: 4.2,
        terrain_contrast: 0.14,
      },
      water: {
        is_show: true,
        color: '#f8fbff',
        coverage: 0.52,
        gloss: 0.7,
      },
      land: {
        color: '#f2b8da',
        secondary_color: '#7fcef4',
        coverage: 0.52,
      },
      clouds: {
        is_show: true,
        color: '#ffffff',
        opacity: 0.12,
        coverage: 0.38,
        speed: 0.08,
      },
      atmosphere_visual: {
        is_show: true,
        color: '#e9f4ff',
        intensity: 0.5,
        rim_power: 2.6,
      },
      poles: {
        is_show: true,
        color: '#79c8ef',
        size: 0.24,
      },
      equator: {
        is_show: true,
        color: '#fffdfd',
        width: 0.12,
        intensity: 0.82,
      },
    },
  } as const;

  const defaults: Record<
    BodyPresentationType,
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

  const kindOverrides = {
    blackhole: {
      surfaceBase: '#16081f',
      surfaceShadow: '#020104',
      water: '#2a0d33',
      land: '#4a124a',
      landSecondary: '#8b42ff',
      clouds: '#d8a9ff',
      atmosphere: '#8c3fff',
      poles: '#c78cff',
      equator: '#ff9a4d',
      waterVisible: false,
    },
    star: {
      surfaceBase: '#ffd27a',
      surfaceShadow: '#7f2500',
      water: '#ffbe61',
      land: '#ff8a33',
      landSecondary: '#fff1a3',
      clouds: '#fff4d4',
      atmosphere: '#ffbf69',
      poles: '#fff0cf',
      equator: '#ffd28c',
      waterVisible: false,
    },
    moon: {
      surfaceBase: '#c8ccd5',
      surfaceShadow: '#373d4d',
      water: '#a9b3c4',
      land: '#b6bcc9',
      landSecondary: '#edf0f5',
      clouds: '#f1f4f8',
      atmosphere: '#cbd6e7',
      poles: '#ffffff',
      equator: '#d7dde8',
      waterVisible: false,
    },
    asteroid: {
      surfaceBase: '#8b7763',
      surfaceShadow: '#2f241e',
      water: '#8c7b68',
      land: '#9b7b57',
      landSecondary: '#c3a07c',
      clouds: '#e5d4bf',
      atmosphere: '#d3b690',
      poles: '#f0dcc4',
      equator: '#cba37a',
      waterVisible: false,
    },
    planet: null,
    'ring-system': {
      surfaceBase: '#d4c4aa',
      surfaceShadow: '#645544',
      water: '#d7cfbf',
      land: '#b79f7c',
      landSecondary: '#f0e7d3',
      clouds: '#f7f3eb',
      atmosphere: '#e7dcc6',
      poles: '#fff8ef',
      equator: '#dbc6a2',
      waterVisible: false,
    },
  } as const;

  const palette = kindOverrides[presentation.kind] ?? defaults[presentation.type];
  const profile = presentation.profile;
  const averageKelvin = getBodyTemperatureBand(profile)?.averageKelvin ?? null;
  const massKilograms = resolveMassKilograms(profile?.mass);
  const starPhysicalColor =
    presentation.kind === 'star' && typeof averageKelvin === 'number'
      ? estimateBlackbodyColorHex(averageKelvin)
      : null;
  const blackholeDiskColor =
    presentation.kind === 'blackhole' && typeof massKilograms === 'number'
      ? estimateBlackbodyColorHex(
          estimateBlackholeAccretionDiskTemperatureKelvin(massKilograms) ?? NaN,
        )
      : null;
  const appearance = profile?.appearance;
  const templateName = appearance?.template as keyof typeof appearanceTemplatePresets | undefined;
  const template = templateName ? appearanceTemplatePresets[templateName] : undefined;
  const surface = {
    ...template?.surface,
    base_color: appearance?.surface?.baseColor,
    shadow_color: appearance?.surface?.shadowColor,
    terrain_scale: appearance?.surface?.terrainScale,
    terrain_contrast: appearance?.surface?.terrainContrast,
  };
  const water = {
    ...template?.water,
    is_show: appearance?.water?.visible,
    color: appearance?.water?.color,
    coverage: appearance?.water?.coverage,
    gloss: appearance?.water?.gloss,
  };
  const land = {
    ...template?.land,
    color: appearance?.land?.color,
    secondary_color: appearance?.land?.secondaryColor,
    coverage: appearance?.land?.coverage,
  };
  const clouds = {
    ...template?.clouds,
    is_show: appearance?.clouds?.visible,
    color: appearance?.clouds?.color,
    opacity: appearance?.clouds?.opacity,
    coverage: appearance?.clouds?.coverage,
    speed: appearance?.clouds?.speed,
  };
  const atmosphereVisual = {
    ...template?.atmosphere_visual,
    is_show: appearance?.atmosphereVisual?.visible,
    color: appearance?.atmosphereVisual?.color,
    intensity: appearance?.atmosphereVisual?.intensity,
    rim_power: appearance?.atmosphereVisual?.rimPower,
  };
  const poles = { ...template?.poles, ...appearance?.poles };
  const equator = { ...template?.equator, ...appearance?.equator };

  const baseColor = getBodyColor(
    surface?.base_color ?? profile?.color,
    starPhysicalColor ?? blackholeDiskColor ?? palette.surfaceBase,
  );
  const shadowColor = getBodyColor(
    surface?.shadow_color ?? profile?.background,
    palette.surfaceShadow,
  );
  const waterVisible = water?.is_show ?? palette.waterVisible;
  const waterColor = getBodyColor(
    water?.color,
    baseColor.clone().lerp(new THREE.Color(palette.water), 0.64),
  );
  const landColor = getBodyColor(
    land?.color,
    baseColor.clone().lerp(new THREE.Color(palette.land), 0.56),
  );
  const landSecondaryColor = getBodyColor(
    land?.secondary_color,
    landColor.clone().lerp(new THREE.Color(palette.landSecondary), 0.42),
  );
  const cloudVisible = clouds?.is_show ?? profile?.atmosphere?.visible ?? waterVisible;
  const cloudColor = getBodyColor(clouds?.color, palette.clouds);
  const atmosphereVisible = atmosphereVisual?.is_show ?? profile?.atmosphere?.visible ?? false;
  const atmosphereColor = getBodyColor(
    atmosphereVisual?.color,
    starPhysicalColor ?? blackholeDiskColor ?? palette.atmosphere,
  );
  const poleVisible =
    poles?.is_show ??
    (presentation.kind === 'star' || presentation.kind === 'blackhole'
      ? false
      : presentation.type !== 'hot');
  const poleColor = getBodyColor(poles?.color, palette.poles);
  const equatorVisible =
    equator?.is_show ??
    (presentation.kind === 'asteroid' || presentation.kind === 'ring-system' ? false : true);
  const equatorColor = getBodyColor(
    equator?.color,
    blackholeDiskColor ?? starPhysicalColor ?? palette.equator,
  );

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
    terrainScale: clamp(
      surface?.terrain_scale ??
        (presentation.kind === 'asteroid' ? 10.8 : presentation.kind === 'moon' ? 7.4 : 6.4),
      2,
      18,
    ),
    terrainContrast: clamp(
      surface?.terrain_contrast ??
        (presentation.kind === 'blackhole'
          ? 0.72
          : presentation.kind === 'star'
            ? 0.26
            : presentation.kind === 'asteroid'
              ? 0.58
              : 0.42),
      0.05,
      0.95,
    ),
    cloudVisible,
    cloudColor,
    cloudOpacity: clamp(
      clouds?.opacity ??
        (presentation.kind === 'star' ? 0.18 : presentation.kind === 'blackhole' ? 0.14 : 0.28),
      0,
      0.9,
    ),
    cloudCoverage: clamp(
      clouds?.coverage ??
        (presentation.kind === 'star' ? 0.62 : presentation.kind === 'blackhole' ? 0.22 : 0.46),
      0.08,
      0.96,
    ),
    cloudSpeed: clamp(
      clouds?.speed ??
        (presentation.kind === 'star' ? 0.42 : presentation.kind === 'blackhole' ? 0.08 : 0.18),
      0,
      1.5,
    ),
    atmosphereVisible,
    atmosphereColor,
    atmosphereIntensity: clamp(
      atmosphereVisual?.intensity ??
        (presentation.kind === 'blackhole' ? 0.86 : presentation.kind === 'star' ? 0.72 : 0.56),
      0,
      1,
    ),
    atmosphereRimPower: clamp(
      atmosphereVisual?.rim_power ??
        (presentation.kind === 'blackhole' ? 4.4 : presentation.kind === 'star' ? 2.1 : 2.8),
      1.2,
      6,
    ),
    poleVisible,
    poleColor,
    poleSize: clamp(poles?.size ?? 0.16, 0.03, 0.42),
    equatorVisible,
    equatorColor,
    equatorWidth: clamp(equator?.width ?? 0.08, 0.02, 0.24),
    equatorIntensity: clamp(equator?.intensity ?? 0.32, 0, 1),
    appearanceTemplate: templateName ?? 'default',
  };
};
