import {
  estimateBlackbodyColorHex,
  estimateStellarLuminositySolar,
  estimateStellarSpectralClass,
} from '@blackhole/simulation/physics/bodyPhysics';

import type { BodyDefinition } from './bodyTypes';
import { resolveAverageTemperatureKelvin, resolveBodyMassKilograms } from './bodyDerivedResolvers';

export type BodyStellarDerivedState = {
  averageTemperatureKelvin: number | null;
  stellarLuminositySolar: number | null;
  stellarSpectralClass: string | null;
  stellarColor: string | null;
  inputState: {
    temperature: 'body-explicit' | 'presentation-fallback' | 'missing';
    mass: 'body-explicit' | 'presentation-fallback' | 'missing';
  };
};

export const deriveStellarState = (bodyDefinition: BodyDefinition): BodyStellarDerivedState => {
  const averageTemperatureKelvin = resolveAverageTemperatureKelvin(bodyDefinition);
  const massKilograms = resolveBodyMassKilograms(bodyDefinition.body, bodyDefinition.presentation);

  return {
    averageTemperatureKelvin,
    stellarLuminositySolar:
      bodyDefinition.body.kind === 'star' && typeof massKilograms === 'number'
        ? estimateStellarLuminositySolar(massKilograms)
        : null,
    stellarSpectralClass:
      bodyDefinition.body.kind === 'star' && typeof averageTemperatureKelvin === 'number'
        ? estimateStellarSpectralClass(averageTemperatureKelvin)
        : null,
    stellarColor:
      bodyDefinition.body.kind === 'star' && typeof averageTemperatureKelvin === 'number'
        ? estimateBlackbodyColorHex(averageTemperatureKelvin)
        : null,
    inputState: {
      temperature:
        typeof bodyDefinition.body.physical?.temperatureKelvinMin === 'number' ||
        typeof bodyDefinition.body.physical?.temperatureKelvinMax === 'number'
          ? 'body-explicit'
          : typeof bodyDefinition.presentation?.profile?.temperature?.min === 'number' ||
              typeof bodyDefinition.presentation?.profile?.temperature?.max === 'number'
            ? 'presentation-fallback'
            : 'missing',
      mass: bodyDefinition.body.physical?.mass
        ? 'body-explicit'
        : bodyDefinition.presentation?.profile?.mass
          ? 'presentation-fallback'
          : 'missing',
    },
  };
};
