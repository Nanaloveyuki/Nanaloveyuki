import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import { adaptLegacyFriendPlanetToCelestialBody } from '@blackhole/domain/friendPlanetAdapter';
import type { LegacyFriendPlanet } from '@blackhole/types';

import { adaptLegacyFriendPlanetToBodyDefinition } from '../bodies/bodyFactories';
import {
  deriveBodyState,
  getBodyOrbitRadius,
  getBodyOrbitSpeed,
  getBodyRadius,
  getBodyRotationSpeed,
} from '../bodies/bodyDerivedState';

export const getLegacyFriendPlanetBody = (legacyFriend: LegacyFriendPlanet): CelestialBody =>
  adaptLegacyFriendPlanetToCelestialBody(legacyFriend);

export const getPlanetRadius = (legacyFriend: LegacyFriendPlanet, fallbackRadius: number) =>
  getBodyRadius(adaptLegacyFriendPlanetToBodyDefinition(legacyFriend), fallbackRadius);

export const getPlanetOrbitDistanceMeters = (legacyFriend: LegacyFriendPlanet) =>
  deriveBodyState(adaptLegacyFriendPlanetToBodyDefinition(legacyFriend)).orbitDistanceMeters;

export const getPlanetOrbitRadius = (
  legacyFriend: LegacyFriendPlanet,
  fallbackOrbitRadius: number,
) => getBodyOrbitRadius(adaptLegacyFriendPlanetToBodyDefinition(legacyFriend), fallbackOrbitRadius);

export const getPlanetOrbitSpeed = (legacyFriend: LegacyFriendPlanet, fallbackOrbitSpeed: number) =>
  getBodyOrbitSpeed(adaptLegacyFriendPlanetToBodyDefinition(legacyFriend), fallbackOrbitSpeed);

export const getPlanetRotationSpeed = (
  legacyFriend: LegacyFriendPlanet,
  fallbackRotationSpeed: number,
) =>
  getBodyRotationSpeed(
    adaptLegacyFriendPlanetToBodyDefinition(legacyFriend),
    fallbackRotationSpeed,
  );

export const getPlanetAxialTilt = (legacyFriend: LegacyFriendPlanet) =>
  deriveBodyState(adaptLegacyFriendPlanetToBodyDefinition(legacyFriend)).axialTiltRadians;

export const getFriendPlanetBody = getLegacyFriendPlanetBody;
