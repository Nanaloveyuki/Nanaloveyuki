import * as THREE from 'three';

export const HOST_SELECTOR = '[data-blackhole-root]';
export const PAGE_SELECTOR = '[data-blackhole-page]';
export const SCROLL_TRACK_SELECTOR = '[data-blackhole-scroll-track]';
export const HEADER_SELECTOR = '[data-site-header]';
export const NIGHT_WARNING_SELECTOR = '[data-blackhole-night-warning]';
export const NIGHT_WARNING_CONFIRM_SELECTOR = '[data-blackhole-night-warning-confirm]';
export const FRIEND_TOOLTIP_SELECTOR = '[data-blackhole-friend-tooltip]';
export const PLANET_PANEL_SELECTOR = '[data-blackhole-planet-panel]';
export const PLANET_PANEL_CLOSE_SELECTOR = '[data-blackhole-planet-panel-close]';
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
};

export type FriendPlanetWeightProfile = {
  value?: number;
  unit?: string;
  scientific_notation?: string;
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
};

export type FriendPlanet = {
  name: string;
  url: string;
  type: FriendPlanetType;
  description: string;
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
  __BLACKHOLE_DEMO_INITIALIZED__?: boolean;
  __BLACKHOLE_DEMO_REFRESH__?: () => void;
  __BLACKHOLE_DEMO_HOST__?: HTMLElement | null;
};

export type ControlBasis = {
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
};

export type PlanetEntry = {
  data: FriendPlanet;
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  shell: THREE.Mesh;
  glow: THREE.Sprite;
  ring: THREE.Mesh | null;
  orbitOccluder: THREE.Mesh;
  shellBaseColor: THREE.Color;
  shellBaseOpacity: number;
  glowBaseOpacity: number;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  hueShift: number;
  phase: number;
};
