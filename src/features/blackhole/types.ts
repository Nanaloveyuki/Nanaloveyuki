import * as THREE from 'three';

import type { CelestialBodyKind } from '@blackhole/domain/celestialTypes';

export const HOST_SELECTOR = '[data-blackhole-root]';
export const PAGE_SELECTOR = '[data-blackhole-page]';
export const SCROLL_TRACK_SELECTOR = '[data-blackhole-scroll-track]';
export const HEADER_SELECTOR = '[data-site-header]';
export const NIGHT_WARNING_SELECTOR = '[data-blackhole-night-warning]';
export const NIGHT_WARNING_CONFIRM_SELECTOR = '[data-blackhole-night-warning-confirm]';
export const FRIEND_TOOLTIP_SELECTOR = '[data-blackhole-friend-tooltip]';
export const BODY_PANEL_SELECTOR = '[data-blackhole-body-panel]';
export const BODY_PANEL_CLOSE_SELECTOR = '[data-blackhole-body-panel-close]';
export const BLACKHOLE_BODY_CLASS = 'theme-blackhole';

export type SceneName = 'home' | 'projects' | 'blog' | 'tools';
export type RenderQuality = 'low' | 'medium';
export type FriendPlanetType = 'cool' | 'cold' | 'warm' | 'hot';

export type FriendPlanetRingProfile = {
  is_show?: boolean;
  inner_radius?: number;
  outer_radius?: number;
  color?: string;
};

export type FriendPlanetTemperatureProfile = {
  min?: number;
  max?: number;
  unit?: string;
};

export type FriendPlanetAtmosphereProfile = {
  is_show?: boolean;
  composition?: string;
  pressure?: number;
  pressure_unit?: string;
};

export type FriendPlanetOrbitProfile = {
  is_show?: boolean;
  distance_from_star?: number;
  distance_unit?: string;
  period?: number;
  period_unit?: string;
  parent_id?: string;
  primary_mass?: FriendPlanetWeightProfile;
};

export type FriendPlanetWeightProfile = {
  value?: number;
  unit?: string;
  scientific_notation?: string;
};

export type FriendPlanetSurfaceAppearance = {
  base_color?: string;
  shadow_color?: string;
  terrain_scale?: number;
  terrain_contrast?: number;
};

export type FriendPlanetWaterAppearance = {
  is_show?: boolean;
  color?: string;
  coverage?: number;
  gloss?: number;
};

export type FriendPlanetLandAppearance = {
  color?: string;
  secondary_color?: string;
  coverage?: number;
};

export type FriendPlanetCloudAppearance = {
  is_show?: boolean;
  color?: string;
  opacity?: number;
  coverage?: number;
  speed?: number;
};

export type FriendPlanetAtmosphereVisualProfile = {
  is_show?: boolean;
  color?: string;
  intensity?: number;
  rim_power?: number;
};

export type FriendPlanetPolarAppearance = {
  is_show?: boolean;
  color?: string;
  size?: number;
};

export type FriendPlanetEquatorAppearance = {
  is_show?: boolean;
  color?: string;
  width?: number;
  intensity?: number;
};

export type FriendPlanetAppearanceProfile = {
  template?: string;
  surface?: FriendPlanetSurfaceAppearance;
  water?: FriendPlanetWaterAppearance;
  land?: FriendPlanetLandAppearance;
  clouds?: FriendPlanetCloudAppearance;
  atmosphere_visual?: FriendPlanetAtmosphereVisualProfile;
  poles?: FriendPlanetPolarAppearance;
  equator?: FriendPlanetEquatorAppearance;
};

export type FriendPlanetPhysicsProfile = {
  rotation_speed?: number;
  rotation_unit?: 'hours' | 'days' | 'seconds';
  axial_tilt?: number;
};

export type FriendPlanetProfile = {
  width?: number;
  height?: number;
  radius?: number;
  color?: string;
  background?: string;
  ring?: FriendPlanetRingProfile;
  temperature?: FriendPlanetTemperatureProfile;
  atmosphere?: FriendPlanetAtmosphereProfile;
  orbit?: FriendPlanetOrbitProfile;
  weight?: FriendPlanetWeightProfile;
  appearance?: FriendPlanetAppearanceProfile;
  physics?: FriendPlanetPhysicsProfile;
};

export type BodySourceProfile = {
  width?: number;
  height?: number;
  radius?: number;
  color?: string;
  background?: string;
  ring?: FriendPlanetRingProfile;
  temperature?: FriendPlanetTemperatureProfile;
  atmosphere?: FriendPlanetAtmosphereProfile;
  orbit?: FriendPlanetOrbitProfile;
  mass?: {
    value?: number;
    unit?: string;
    scientific_notation?: string;
  };
  appearance?: FriendPlanetAppearanceProfile;
  physics?: {
    rotation_period?: number;
    rotation_unit?: 'hours' | 'days' | 'seconds';
    axial_tilt?: number;
  };
};

export type BodySource = {
  id?: string;
  name: string;
  url: string;
  kind?: CelestialBodyKind;
  type: FriendPlanetType;
  description: string;
  body?: BodySourceProfile;
  planet?: FriendPlanetProfile;
};

export type BodySourceSetMap = Record<string, BodySource[]>;

export type LegacyFriendPlanet = {
  id?: string;
  name: string;
  url: string;
  kind?: CelestialBodyKind;
  type: FriendPlanetType;
  description: string;
  body?: BodySourceProfile;
  planet?: FriendPlanetProfile;
};

export type PerformanceConfig = {
  resolution: number;
  quality: RenderQuality;
};

export type SceneTarget = {
  distance: number;
  fov: number;
  orbit: boolean;
  dragEnabled: boolean;
  dragRecenter: number;
  keyboardRecenter: number;
  keyboardEnabled: boolean;
  autoYaw: number;
  autoPitch: number;
  forwardOffset: number;
  verticalOffset: number;
  rightOffset: number;
  driftAmplitude: number;
  starYawSpeed: number;
  storyReveal: number;
  riskVisibility: number;
};

export type BlackholeWindow = Window & {
  __BLACKHOLE_BODY_SOURCES__?: BodySource[];
  __BLACKHOLE_BODY_SOURCE_SETS__?: BodySourceSetMap;
  __BLACKHOLE_DEFAULT_BODY_SOURCE_SET__?: string;
  __BLACKHOLE_ACTIVE_BODY_SOURCE_SET__?: string | null;
  __BLACKHOLE_DEMO_INITIALIZED__?: boolean;
  __BLACKHOLE_DEMO_REFRESH__?: () => void;
  __BLACKHOLE_DEMO_HOST__?: HTMLElement | null;
  __BLACKHOLE_RUNTIME_MODE__?: 'home' | 'orbit' | null;
  __BLACKHOLE_DISPOSE__?: () => void;
};

export type ControlBasis = {
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
};

export type LegacyFriendPlanetRuntimeEntry = {
  data: LegacyFriendPlanet;
  pivot: THREE.Group;
  anchor: THREE.Group;
  tiltGroup: THREE.Group;
  mesh: THREE.Mesh;
  shell: THREE.Mesh;
  glow: THREE.Sprite;
  ring: THREE.Points | null;
  orbitOccluder: THREE.Mesh;
  shellBaseColor: THREE.Color;
  shellBaseOpacity: number;
  glowBaseOpacity: number;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  axialTilt: number;
  hueShift: number;
  phase: number;
};

export type LegacyPlanetEntry = LegacyFriendPlanetRuntimeEntry;

export type PlanetEntry = LegacyPlanetEntry;

export type OrbitSceneTarget = {
  distance: number;
  fov: number;
  autoYaw: number;
  autoPitch: number;
  driftAmplitude: number;
  starYawSpeed: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
};

export type BodyPanelElements = {
  panel: HTMLElement | null;
  close: HTMLButtonElement | null;
  type: HTMLElement | null;
  name: HTMLElement | null;
  description: HTMLElement | null;
  preview: HTMLElement | null;
  previewAtmosphere: HTMLElement | null;
  previewPlanet: HTMLElement | null;
  previewWater: HTMLElement | null;
  previewLand: HTMLElement | null;
  previewClouds: HTMLElement | null;
  previewEquator: HTMLElement | null;
  previewPoleNorth: HTMLElement | null;
  previewPoleSouth: HTMLElement | null;
  previewRing: HTMLElement | null;
  previewCopy: HTMLElement | null;
  link: HTMLAnchorElement | null;
  statType: HTMLElement | null;
  statRadius: HTMLElement | null;
  statTemperature: HTMLElement | null;
  statAtmosphere: HTMLElement | null;
  statOrbit: HTMLElement | null;
  statOrbitParent: HTMLElement | null;
  statOrbitSource: HTMLElement | null;
  statHierarchy: HTMLElement | null;
  statWeight: HTMLElement | null;
  statDensity: HTMLElement | null;
  statGravity: HTMLElement | null;
  statPhysics: HTMLElement | null;
  statScaleRadius: HTMLElement | null;
  statScaleOrbit: HTMLElement | null;
  statScaleMotion: HTMLElement | null;
  statInputState: HTMLElement | null;
  statDerivedState: HTMLElement | null;
  statRotation: HTMLElement | null;
  statTilt: HTMLElement | null;
  statPoles: HTMLElement | null;
  statEquator: HTMLElement | null;
  statClouds: HTMLElement | null;
  statSurface: HTMLElement | null;
};

export type LegacyPlanetPanelElements = BodyPanelElements;

export type PlanetPanelElements = LegacyPlanetPanelElements;

export type BodyTooltipElements = {
  root: HTMLElement | null;
  name: HTMLElement | null;
};

export type LegacyFriendTooltipElements = BodyTooltipElements;

export type FriendTooltipElements = LegacyFriendTooltipElements;
