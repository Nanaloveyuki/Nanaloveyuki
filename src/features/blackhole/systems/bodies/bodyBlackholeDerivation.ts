import {
  calculateInnermostStableCircularOrbitKilometers,
  calculateSchwarzschildRadiusKilometers,
  classifyPeakEmissionBand,
  estimateBlackbodyColorHex,
  estimateBlackholeAccretionDiskTemperatureKelvin,
  estimatePeakEmissionWavelengthNanometers,
} from '@blackhole/simulation/physics/bodyPhysics';

import type { BodyDefinition } from './bodyTypes';
import { resolveBodyMassKilograms } from './bodyDerivedResolvers';

export type BodyBlackholeDerivedState = {
  schwarzschildRadiusKilometers: number | null;
  blackholeIscoKilometers: number | null;
  blackholeAccretionDiskTemperatureKelvin: number | null;
  blackholeAccretionDiskColor: string | null;
  blackholePeakEmissionNanometers: number | null;
  blackholePeakEmissionBand: 'x-ray' | 'extreme-uv' | 'ultraviolet' | 'visible' | 'infrared' | null;
};

export const deriveBlackholeState = (bodyDefinition: BodyDefinition): BodyBlackholeDerivedState => {
  const massKilograms = resolveBodyMassKilograms(bodyDefinition.body, bodyDefinition.presentation);
  const blackholeAccretionDiskTemperatureKelvin =
    bodyDefinition.body.kind === 'blackhole' && typeof massKilograms === 'number'
      ? estimateBlackholeAccretionDiskTemperatureKelvin(massKilograms)
      : null;
  const blackholePeakEmissionNanometers =
    bodyDefinition.body.kind === 'blackhole' &&
    typeof blackholeAccretionDiskTemperatureKelvin === 'number'
      ? estimatePeakEmissionWavelengthNanometers(blackholeAccretionDiskTemperatureKelvin)
      : null;

  return {
    schwarzschildRadiusKilometers:
      bodyDefinition.body.kind === 'blackhole' && typeof massKilograms === 'number'
        ? calculateSchwarzschildRadiusKilometers(massKilograms)
        : null,
    blackholeIscoKilometers:
      bodyDefinition.body.kind === 'blackhole' && typeof massKilograms === 'number'
        ? calculateInnermostStableCircularOrbitKilometers(massKilograms)
        : null,
    blackholeAccretionDiskTemperatureKelvin,
    blackholeAccretionDiskColor:
      bodyDefinition.body.kind === 'blackhole' &&
      typeof blackholeAccretionDiskTemperatureKelvin === 'number'
        ? estimateBlackbodyColorHex(blackholeAccretionDiskTemperatureKelvin)
        : null,
    blackholePeakEmissionNanometers,
    blackholePeakEmissionBand:
      bodyDefinition.body.kind === 'blackhole' &&
      typeof blackholePeakEmissionNanometers === 'number'
        ? classifyPeakEmissionBand(blackholePeakEmissionNanometers)
        : null,
  };
};
