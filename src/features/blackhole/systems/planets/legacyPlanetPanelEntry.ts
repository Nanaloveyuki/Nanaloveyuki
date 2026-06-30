import * as THREE from 'three';

import type { LegacyFriendPlanet } from '@blackhole/types';

import {
  adaptLegacyFriendPlanetToBodyDefinition,
  resolveBodyPresentationSource,
} from '../bodies/bodyFactories';
import { deriveBodyState } from '../bodies/bodyDerivedState';
import type { BodyEntry } from '../bodies/bodyTypes';

const EMPTY_GEOMETRY = new THREE.BufferGeometry();
const EMPTY_MATERIAL = new THREE.MeshBasicMaterial();
const EMPTY_SPRITE_MATERIAL = new THREE.SpriteMaterial();

export const createLegacyFriendPlanetPanelEntry = (legacyFriend: LegacyFriendPlanet): BodyEntry => {
  const bodyDefinition = adaptLegacyFriendPlanetToBodyDefinition(legacyFriend);
  const derivedState = deriveBodyState(bodyDefinition);

  return {
    definition: bodyDefinition,
    derivationContext: undefined,
    derivedState,
    data: resolveBodyPresentationSource(bodyDefinition),
    body: bodyDefinition.body,
    pivot: new THREE.Group(),
    orbitPivot: new THREE.Group(),
    anchor: new THREE.Group(),
    orbitAnchor: new THREE.Group(),
    tiltGroup: new THREE.Group(),
    mesh: new THREE.Mesh(EMPTY_GEOMETRY, EMPTY_MATERIAL),
    shell: new THREE.Mesh(EMPTY_GEOMETRY, EMPTY_MATERIAL),
    glow: new THREE.Sprite(EMPTY_SPRITE_MATERIAL),
    ring: null,
    orbitOccluder: new THREE.Mesh(EMPTY_GEOMETRY, EMPTY_MATERIAL),
    shellBaseColor: new THREE.Color('#ffffff'),
    shellBaseOpacity: 0,
    glowBaseColor: new THREE.Color('#ffffff'),
    glowBaseOpacity: 0,
    radius: 0,
    orbitRadius: 0,
    orbitSpeed: 0,
    rotationSpeed: 0,
    axialTilt: 0,
    hueShift: 0,
    phase: 0,
  };
};
