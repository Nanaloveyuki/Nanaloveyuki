import * as THREE from 'three';

import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import type { BodyPresentationSource } from './bodyPresentation';
import type { BodyDerivedState } from './bodyDerivedState';

export type BodyDefinition = {
  body: CelestialBody;
  presentation?: BodyPresentationSource;
};

export type BodyDefinitionMap = Map<string, BodyDefinition>;

export type BodyDerivationContext = {
  bodyDefinitionsById?: BodyDefinitionMap;
};

export type BodyEntry = {
  definition: BodyDefinition;
  derivationContext?: BodyDerivationContext;
  derivedState: BodyDerivedState;
  data: BodyPresentationSource;
  body: CelestialBody;
  pivot: THREE.Group;
  orbitPivot: THREE.Group;
  anchor: THREE.Group;
  orbitAnchor: THREE.Group;
  tiltGroup: THREE.Group;
  mesh: THREE.Mesh;
  shell: THREE.Mesh;
  glow: THREE.Sprite;
  ring: THREE.Points | null;
  orbitOccluder: THREE.Mesh;
  shellBaseColor: THREE.Color;
  shellBaseOpacity: number;
  glowBaseColor: THREE.Color;
  glowBaseOpacity: number;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  axialTilt: number;
  hueShift: number;
  phase: number;
};
