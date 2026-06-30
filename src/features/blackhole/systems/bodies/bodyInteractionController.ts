import * as THREE from 'three';

import { KeyboardMoveControls } from '@blackhole/core/controls';
import type { Observer } from '@blackhole/core/observer';
import type { PerformanceConfig, SceneName } from '@blackhole/types';

import type { BodyDomBridge } from './bodyDomBridge';
import type { BodyEntry } from './bodyTypes';

export type BodyInteractionController = {
  syncDetailResolution: () => void;
  closeInspection: () => void;
  setSelectedBody: (bodyEntry: BodyEntry | null) => void;
  closePanel: () => void;
  openInspection: (bodyEntry: BodyEntry) => void;
  getSelectedBody: () => BodyEntry | null;
  getFocusBody: () => BodyEntry | null;
  setFocusBody: (bodyEntry: BodyEntry | null) => void;
};

type CreateBodyInteractionControllerParams = {
  bodyDomBridge: BodyDomBridge;
  keyboardMoveControl: KeyboardMoveControls;
  observer: Observer;
  performanceConfig: PerformanceConfig;
  getSceneName: () => SceneName;
  getDetailResolutionBoost: () => number;
  setDetailResolutionBoost: (boost: number) => void;
  onDetailResolutionBoostChange: () => void;
};

export const createBodyInteractionController = ({
  bodyDomBridge,
  keyboardMoveControl,
  observer,
  performanceConfig,
  getSceneName,
  getDetailResolutionBoost,
  setDetailResolutionBoost,
  onDetailResolutionBoostChange,
}: CreateBodyInteractionControllerParams): BodyInteractionController => {
  let selectedBodyEntry: BodyEntry | null = null;
  let detailBodyEntry: BodyEntry | null = null;
  let focusBodyEntry: BodyEntry | null = null;
  const inspectionPosition = new THREE.Vector3();

  const syncDetailResolution = () => {
    let nextBoost = 1;
    const inspectionBody = detailBodyEntry ?? focusBodyEntry;

    if (getSceneName() === 'home' && inspectionBody && performanceConfig.quality === 'medium') {
      inspectionBody.mesh.getWorldPosition(inspectionPosition);
      const inspectionDistance = observer.position.distanceTo(inspectionPosition);
      const inspectionThreshold = Math.max(inspectionBody.radius * 10, 3.4);

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
    detailBodyEntry = null;
    focusBodyEntry = null;
    syncDetailResolution();
  };

  const setSelectedBody = (bodyEntry: BodyEntry | null) => {
    if (selectedBodyEntry === bodyEntry) {
      return;
    }

    if (detailBodyEntry && detailBodyEntry !== bodyEntry) {
      closeInspection();
      bodyDomBridge.closePanel();
    }

    selectedBodyEntry = bodyEntry;
  };

  const closePanel = () => {
    closeInspection();
    selectedBodyEntry = null;
    bodyDomBridge.closePanel();
  };

  const openInspection = (bodyEntry: BodyEntry) => {
    setSelectedBody(bodyEntry);
    detailBodyEntry = bodyEntry;
    focusBodyEntry = bodyEntry;
    keyboardMoveControl.velocity.multiplyScalar(0.2);
    bodyDomBridge.openPanel(bodyEntry);
    syncDetailResolution();
  };

  const setFocusBody = (bodyEntry: BodyEntry | null) => {
    if (focusBodyEntry === bodyEntry) {
      return;
    }

    focusBodyEntry = bodyEntry;
    syncDetailResolution();
  };

  return {
    syncDetailResolution,
    closeInspection,
    setSelectedBody,
    closePanel,
    openInspection,
    getSelectedBody: () => selectedBodyEntry,
    getFocusBody: () => focusBodyEntry,
    setFocusBody,
  };
};
