import { readdir, readFile } from 'node:fs/promises';

import type { FriendPlanet } from '../scripts/blackhole/types';

const FRIEND_PLANET_DIRECTORY_URL = new URL('../../public/friend-planets/', import.meta.url);
const FRIEND_PLANET_EXAMPLE_FILE = '.example-friend.json';

const isFriendPlanetJsonFile = (entryName: string) =>
  entryName.endsWith('.json') && entryName !== FRIEND_PLANET_EXAMPLE_FILE;

const readFriendPlanetFile = async (entryName: string) => {
  const fileUrl = new URL(entryName, FRIEND_PLANET_DIRECTORY_URL);
  const fileContent = await readFile(fileUrl, 'utf-8');
  return JSON.parse(fileContent) as FriendPlanet;
};

export const getFriendPlanets = async () => {
  const directoryEntries = await readdir(FRIEND_PLANET_DIRECTORY_URL, { withFileTypes: true });
  const friendPlanetFileNames = directoryEntries
    .filter((entry) => entry.isFile() && isFriendPlanetJsonFile(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(friendPlanetFileNames.map(readFriendPlanetFile));
};
