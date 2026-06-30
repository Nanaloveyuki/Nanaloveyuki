import * as THREE from 'three';

import type {
  FriendPlanetType,
  LegacyFriendPlanet,
  LegacyFriendPlanetRuntimeEntry,
} from '@blackhole/types';

import { adaptLegacyFriendPlanetToBodyDefinition, buildBodyEntry } from '../bodies/bodyFactories';
import {
  createBodyMaterial,
  createBodyRing,
  getBodyGlowTexture,
  getBodyShellAppearance,
} from '../bodies/bodyRenderFactories';
import { adaptLegacyFriendPlanetToBodyPresentationSource } from '../bodies/bodyPresentation';

export const getPlanetGlowTexture = getBodyGlowTexture;

export const getPlanetShellAppearance = (
  legacyFriend: LegacyFriendPlanet,
  type: FriendPlanetType,
) => getBodyShellAppearance(adaptLegacyFriendPlanetToBodyPresentationSource(legacyFriend), type);

export const createPlanetMaterial = (legacyFriend: LegacyFriendPlanet) =>
  createBodyMaterial(adaptLegacyFriendPlanetToBodyPresentationSource(legacyFriend));

export const createPlanetRing = (legacyFriend: LegacyFriendPlanet, planetRadius: number) =>
  createBodyRing(adaptLegacyFriendPlanetToBodyPresentationSource(legacyFriend), planetRadius);

export type BuildPlanetEntryParams = {
  friend: LegacyFriendPlanet;
  index: number;
  hash: number;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  axialTilt: number;
  planetGroup: THREE.Group;
  orbitGroup: THREE.Group;
  glowTextures: Map<FriendPlanetType, THREE.Texture>;
};

export const buildPlanetEntry = ({
  friend,
  index,
  hash,
  size,
  orbitRadius,
  orbitSpeed,
  rotationSpeed,
  axialTilt,
  planetGroup,
  orbitGroup,
  glowTextures,
}: BuildPlanetEntryParams): LegacyFriendPlanetRuntimeEntry => {
  const bodyEntry = buildBodyEntry({
    bodyDefinition: adaptLegacyFriendPlanetToBodyDefinition(friend),
    index,
    hash,
    size,
    orbitRadius,
    orbitSpeed,
    rotationSpeed,
    axialTilt,
    bodyGroup: planetGroup,
    orbitGroup,
    glowTextures,
  });

  bodyEntry.mesh.userData.friendPlanet = friend;

  const legacyEntry = {
    ...bodyEntry,
    data: friend,
  };

  return legacyEntry;
};
