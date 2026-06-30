import * as THREE from 'three';

import type { BodyEntry } from '../bodies/bodyTypes';
import type { LegacyFriendPlanet, LegacyFriendPlanetRuntimeEntry } from '@blackhole/types';

import { createBodySystem } from '../bodies/bodySystem';

export type LegacyPlanetSystem = {
  planetGroup: THREE.Group;
  orbitGroup: THREE.Group;
  entries: LegacyFriendPlanetRuntimeEntry[];
  clickableMeshes: THREE.Mesh[];
  glowTextures: Map<LegacyFriendPlanet['type'], THREE.Texture>;
  dispose: () => void;
  build: (legacyFriends: LegacyFriendPlanet[]) => void;
  update: (delta: number, selectedPlanetEntry: LegacyFriendPlanetRuntimeEntry | null) => void;
  updateUniforms: (time: number, origin: THREE.Vector3) => void;
  getEntryByMesh: (mesh?: THREE.Mesh) => LegacyFriendPlanetRuntimeEntry | null;
};

export const createLegacyPlanetSystem = (
  overlayScene: THREE.Scene,
  orbitScene: THREE.Scene,
): LegacyPlanetSystem => {
  const bodySystem = createBodySystem(overlayScene, orbitScene);

  return {
    planetGroup: bodySystem.bodyGroup,
    orbitGroup: bodySystem.orbitGroup,
    entries: bodySystem.bodyEntries,
    clickableMeshes: bodySystem.clickableBodies,
    glowTextures: bodySystem.glowTextures,
    dispose: bodySystem.dispose,
    build: bodySystem.buildFromLegacyFriendPlanets,
    update: (delta, selectedPlanetEntry) =>
      bodySystem.update(delta, selectedPlanetEntry as BodyEntry | null),
    updateUniforms: bodySystem.updateUniforms,
    getEntryByMesh: (mesh) => bodySystem.getEntryByMesh(mesh),
  };
};

export type PlanetSystem = LegacyPlanetSystem;
export const createPlanetSystem = createLegacyPlanetSystem;
