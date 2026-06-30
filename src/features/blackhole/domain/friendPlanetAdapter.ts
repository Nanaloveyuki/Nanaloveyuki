import type { CelestialBody } from '@blackhole/domain/celestialTypes';
import type { LegacyFriendPlanet } from '@blackhole/types';

import {
  adaptBodySourceToCelestialBody,
  adaptLegacyFriendPlanetToBodySource,
} from './bodySourceAdapter';

export const adaptLegacyFriendPlanetToCelestialBody = (
  legacyFriend: LegacyFriendPlanet,
): CelestialBody =>
  adaptBodySourceToCelestialBody(adaptLegacyFriendPlanetToBodySource(legacyFriend));
