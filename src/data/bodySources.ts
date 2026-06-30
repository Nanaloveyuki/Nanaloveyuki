import type { BodySource, BodySourceSetMap } from '@blackhole/types';

type BodySourceModuleExport = BodySource | BodySource[];

const bodySourceModules = import.meta.glob<{ default: BodySourceModuleExport }>(
  './body-sources/*.json',
  {
    eager: true,
  },
);

const getBodySourceFileName = (modulePath: string) => modulePath.split('/').at(-1) ?? modulePath;

const isExampleBodySourceModule = (modulePath: string) =>
  getBodySourceFileName(modulePath).startsWith('.example-');

const normalizeBodySourceModuleExport = (moduleExport: BodySourceModuleExport): BodySource[] =>
  Array.isArray(moduleExport) ? moduleExport : [moduleExport];

const getBodySourceSetKey = (modulePath: string) =>
  getBodySourceFileName(modulePath)
    .replace(/\.json$/u, '')
    .replace(/^\./u, '');

export const getBodySourceSets = async (): Promise<BodySourceSetMap> => {
  const sortedEntries = Object.entries(bodySourceModules).sort(([leftPath], [rightPath]) =>
    leftPath.localeCompare(rightPath),
  );

  const runtimeSources = sortedEntries
    .filter(([modulePath]) => !isExampleBodySourceModule(modulePath))
    .flatMap(([, module]) => normalizeBodySourceModuleExport(module.default));

  const exampleSourceSets = Object.fromEntries(
    sortedEntries
      .filter(([modulePath]) => isExampleBodySourceModule(modulePath))
      .map(([modulePath, module]) => [
        getBodySourceSetKey(modulePath),
        normalizeBodySourceModuleExport(module.default),
      ]),
  );

  return {
    default: runtimeSources,
    ...exampleSourceSets,
  };
};

export const getBodySources = async (): Promise<BodySource[]> => {
  const bodySourceSets = await getBodySourceSets();
  return bodySourceSets.default ?? [];
};
