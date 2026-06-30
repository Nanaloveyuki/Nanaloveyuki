export {
  getLegacyFriendPlanetBody as getLegacyPlanetBody,
  getLegacyFriendPlanetBody as getFriendPlanetBody,
  getPlanetAxialTilt,
  getPlanetOrbitDistanceMeters,
  getPlanetOrbitRadius,
  getPlanetOrbitSpeed,
  getPlanetRadius,
  getPlanetRotationSpeed,
} from './planetDerivedState';

export {
  buildPlanetEntry as buildLegacyPlanetEntry,
  createPlanetMaterial as createLegacyPlanetMaterial,
  createPlanetRing as createLegacyPlanetRing,
  getPlanetGlowTexture as getLegacyPlanetGlowTexture,
  getPlanetShellAppearance as getLegacyPlanetShellAppearance,
  buildPlanetEntry,
  createPlanetMaterial,
  createPlanetRing,
  getPlanetGlowTexture,
  getPlanetShellAppearance,
} from './planetRenderFactories';

export type {
  BuildPlanetEntryParams,
  BuildPlanetEntryParams as BuildLegacyPlanetEntryParams,
} from './planetRenderFactories';
