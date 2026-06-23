import type { FriendPlanet } from '@blackhole/types';

const FRIEND_PLANET_EXAMPLE_FILE = '.example-friend.json';
const friendPlanetModules = import.meta.glob<{ default: FriendPlanet }>('./friend-planets/*.json', {
  eager: true,
});

const isFriendPlanetModule = (modulePath: string) =>
  !modulePath.endsWith(`/${FRIEND_PLANET_EXAMPLE_FILE}`);

export const getFriendPlanets = async () =>
  Object.entries(friendPlanetModules)
    .filter(([modulePath]) => isFriendPlanetModule(modulePath))
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([, module]) => module.default);
