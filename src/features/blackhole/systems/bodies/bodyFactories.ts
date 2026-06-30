import {
  adaptBodySourceToCelestialBody,
  adaptLegacyFriendPlanetToBodySource,
} from '@blackhole/domain/bodySourceAdapter';
import type { BodySource, LegacyFriendPlanet } from '@blackhole/types';

import {
  adaptBodySourceToBodyPresentationSource,
  adaptLegacyFriendPlanetToBodyPresentationSource,
  createFallbackBodyPresentationSource,
} from './bodyPresentation';
import { deriveBodyState } from './bodyDerivedState';
import { buildBodyRenderEntry, type BuildBodyRenderEntryParams } from './bodyRenderFactories';
import type { BodyDefinition, BodyDerivationContext, BodyEntry } from './bodyTypes';

export const adaptBodySourceToBodyDefinition = (source: BodySource): BodyDefinition => ({
  body: adaptBodySourceToCelestialBody(source),
  presentation: adaptBodySourceToBodyPresentationSource(source),
});

export const adaptBodySourcesToBodyDefinitions = (sources: BodySource[]) =>
  sources.map(adaptBodySourceToBodyDefinition);

export const adaptLegacyFriendPlanetToBodyDefinition = (
  legacyFriend: LegacyFriendPlanet,
): BodyDefinition => ({
  body: adaptBodySourceToCelestialBody(adaptLegacyFriendPlanetToBodySource(legacyFriend)),
  presentation: adaptLegacyFriendPlanetToBodyPresentationSource(legacyFriend),
});

export const adaptLegacyFriendPlanetsToBodyDefinitions = (legacyFriends: LegacyFriendPlanet[]) =>
  legacyFriends.map(adaptLegacyFriendPlanetToBodyDefinition);

export const resolveBodyPresentationSource = (bodyDefinition: BodyDefinition) =>
  bodyDefinition.presentation ?? createFallbackBodyPresentationSource(bodyDefinition.body);

export type BuildBodyEntryParams = Omit<
  BuildBodyRenderEntryParams,
  'presentation' | 'derivedState'
> & {
  bodyDefinition: BodyDefinition;
  derivationContext?: BodyDerivationContext;
};

export const buildBodyEntry = (params: BuildBodyEntryParams): BodyEntry => {
  const presentation = resolveBodyPresentationSource(params.bodyDefinition);
  const derivedState = deriveBodyState(params.bodyDefinition, params.derivationContext);
  const renderEntry = buildBodyRenderEntry({
    ...params,
    presentation,
    derivedState,
  });

  return {
    ...renderEntry,
    definition: params.bodyDefinition,
    derivationContext: params.derivationContext,
    derivedState,
    data: presentation,
    body: params.bodyDefinition.body,
  };
};
