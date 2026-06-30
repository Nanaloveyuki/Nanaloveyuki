import * as THREE from 'three';

import { KeyboardMoveControls } from '@blackhole/core/controls';
import type { Observer } from '@blackhole/core/observer';
import type { LegacyPlanetEntry, PerformanceConfig, SceneName } from '@blackhole/types';

import type { LegacyPlanetDomBridge } from './planetDomBridge';

export type LegacyPlanetInteractionController = {
  syncDetailResolution: () => void;
  closeInspection: () => void;
  setSelectedPlanet: (planetEntry: LegacyPlanetEntry | null) => void;
  closePanel: () => void;
  openInspection: (planetEntry: LegacyPlanetEntry) => void;
  getSelectedPlanet: () => LegacyPlanetEntry | null;
  getFocusPlanet: () => LegacyPlanetEntry | null;
  setFocusPlanet: (planetEntry: LegacyPlanetEntry | null) => void;
};

type CreateLegacyPlanetInteractionControllerParams = {
  planetDomBridge: LegacyPlanetDomBridge;
  keyboardMoveControl: KeyboardMoveControls;
  observer: Observer;
  performanceConfig: PerformanceConfig;
  getSceneName: () => SceneName;
  getDetailResolutionBoost: () => number;
  setDetailResolutionBoost: (boost: number) => void;
  onDetailResolutionBoostChange: () => void;
};

export const createLegacyPlanetInteractionController = ({
  planetDomBridge,
  keyboardMoveControl,
  observer,
  performanceConfig,
  getSceneName,
  getDetailResolutionBoost,
  setDetailResolutionBoost,
  onDetailResolutionBoostChange,
}: CreateLegacyPlanetInteractionControllerParams): LegacyPlanetInteractionController => {
  let selectedPlanetEntry: LegacyPlanetEntry | null = null;
  let detailPlanetEntry: LegacyPlanetEntry | null = null;
  let focusPlanetEntry: LegacyPlanetEntry | null = null;
  const inspectionPosition = new THREE.Vector3();

  const syncDetailResolution = () => {
    let nextBoost = 1;
    const inspectionPlanet = detailPlanetEntry ?? focusPlanetEntry;

    if (getSceneName() === 'home' && inspectionPlanet && performanceConfig.quality === 'medium') {
      inspectionPlanet.mesh.getWorldPosition(inspectionPosition);
      const inspectionDistance = observer.position.distanceTo(inspectionPosition);
      const inspectionThreshold = Math.max(inspectionPlanet.radius * 10, 3.4);

      if (inspectionDistance <= inspectionThreshold) {
        nextBoost = performanceConfig.resolution >= 1 ? 1.25 : 1.1;
      }
    }

    if (Math.abs(getDetailResolutionBoost() - nextBoost) < 0.01) {
      return;
    }

    setDetailResolutionBoost(nextBoost);
    onDetailResolutionBoostChange();
  };

  const closeInspection = () => {
    detailPlanetEntry = null;
    focusPlanetEntry = null;
    syncDetailResolution();
  };

  const setSelectedPlanet = (planetEntry: LegacyPlanetEntry | null) => {
    if (selectedPlanetEntry === planetEntry) {
      return;
    }

    if (detailPlanetEntry && detailPlanetEntry !== planetEntry) {
      closeInspection();
      planetDomBridge.closePanel();
    }

    selectedPlanetEntry = planetEntry;
  };

  const closePanel = () => {
    closeInspection();
    selectedPlanetEntry = null;
    planetDomBridge.closePanel();
  };

  const openInspection = (planetEntry: LegacyPlanetEntry) => {
    setSelectedPlanet(planetEntry);
    detailPlanetEntry = planetEntry;
    focusPlanetEntry = planetEntry;
    keyboardMoveControl.velocity.multiplyScalar(0.2);
    planetDomBridge.openPanel(planetEntry.data);
    syncDetailResolution();
  };

  const setFocusPlanet = (planetEntry: LegacyPlanetEntry | null) => {
    if (focusPlanetEntry === planetEntry) {
      return;
    }

    focusPlanetEntry = planetEntry;
    syncDetailResolution();
  };

  return {
    syncDetailResolution,
    closeInspection,
    setSelectedPlanet,
    closePanel,
    openInspection,
    getSelectedPlanet: () => selectedPlanetEntry,
    getFocusPlanet: () => focusPlanetEntry,
    setFocusPlanet,
  };
};

export type PlanetInteractionController = LegacyPlanetInteractionController;
export type CreatePlanetInteractionControllerParams = CreateLegacyPlanetInteractionControllerParams;
export const createPlanetInteractionController = createLegacyPlanetInteractionController;
