import * as THREE from 'three';

import { CameraDragControls, KeyboardMoveControls } from '@blackhole/core/controls';
import { Observer } from '@blackhole/core/observer';
import { clamp } from '@blackhole/math';
import { getMinimumHomeDistance, lerpAngle } from '@blackhole/scenes/homeSceneMath';
import type { SceneTarget } from '@blackhole/types';

import type { BodyEntry } from '@blackhole/systems/bodies/bodyTypes';

type HomePresentationControllerParams = {
  delta: number;
  target: SceneTarget;
  scrollProgress: number;
  pageHost: HTMLElement | null;
  observer: Observer;
  homeBaseDirection: THREE.Vector3;
  origin: THREE.Vector3;
  worldUp: THREE.Vector3;
  moveAnchor: THREE.Vector3;
  cameraControl: CameraDragControls;
  keyboardMoveControl: KeyboardMoveControls;
  bodyEntries: BodyEntry[];
  focusBodyEntry: BodyEntry | null;
  openBodyInspection: (bodyEntry: BodyEntry) => void;
  syncBodyDetailResolution: () => void;
  cameraDistance: number;
};

const syncHomeCameraBasis = (
  cameraControl: CameraDragControls,
  worldUp: THREE.Vector3,
  forward: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
) => {
  forward.set(
    Math.sin(cameraControl.yaw) * Math.cos(cameraControl.pitch),
    Math.sin(cameraControl.pitch),
    -Math.cos(cameraControl.yaw) * Math.cos(cameraControl.pitch),
  );
  forward.normalize();

  right.crossVectors(forward, worldUp);
  if (right.lengthSq() <= 1e-6) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }

  up.crossVectors(right, forward).normalize();
};

export const createHomePresentationController = () => {
  const homeBasePosition = new THREE.Vector3();
  const homeForward = new THREE.Vector3();
  const currentCameraPosition = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upVector = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const homeCenterDirection = new THREE.Vector3();
  const focusBodyPosition = new THREE.Vector3();
  const focusOutward = new THREE.Vector3();
  const focusDesiredPosition = new THREE.Vector3();
  const focusDesiredForward = new THREE.Vector3();
  const worldBodyPosition = new THREE.Vector3();
  const pushDirection = new THREE.Vector3();

  const update = ({
    delta,
    target,
    scrollProgress,
    pageHost,
    observer,
    homeBaseDirection,
    origin,
    worldUp,
    moveAnchor,
    cameraControl,
    keyboardMoveControl,
    bodyEntries,
    focusBodyEntry,
    openBodyInspection,
    syncBodyDetailResolution,
    cameraDistance,
  }: HomePresentationControllerParams) => {
    homeBasePosition.copy(homeBaseDirection).multiplyScalar(cameraDistance);

    let activeFocusBodyEntry = focusBodyEntry;
    const isBodyFocusTransitionActive = activeFocusBodyEntry !== null;
    const homeLockProgress = clamp(target.dragRecenter / 0.18, 0, 1);

    cameraControl.setEnabled(target.dragEnabled && !isBodyFocusTransitionActive);
    cameraControl.update(0);
    syncHomeCameraBasis(cameraControl, worldUp, homeForward, right, upVector);

    currentCameraPosition.copy(homeBasePosition).add(keyboardMoveControl.offset);
    keyboardMoveControl.update(
      delta,
      currentCameraPosition.length(),
      target.keyboardEnabled && !isBodyFocusTransitionActive,
      target.keyboardRecenter,
      {
        forward: homeForward,
        right,
        up: worldUp,
      },
    );

    currentCameraPosition.copy(homeBasePosition).add(keyboardMoveControl.offset);
    bodyEntries.forEach((bodyEntry) => {
      bodyEntry.mesh.getWorldPosition(worldBodyPosition);

      const minimumDistance = bodyEntry.radius + 0.72;
      const distanceToBody = currentCameraPosition.distanceTo(worldBodyPosition);

      if (distanceToBody >= minimumDistance) {
        return;
      }

      pushDirection.copy(currentCameraPosition).sub(worldBodyPosition);
      if (pushDirection.lengthSq() <= 1e-6) {
        pushDirection.copy(homeForward).negate();
      }

      pushDirection.normalize();
      currentCameraPosition.copy(
        worldBodyPosition.add(pushDirection.multiplyScalar(minimumDistance)),
      );
      keyboardMoveControl.velocity.multiplyScalar(0.24);
      openBodyInspection(bodyEntry);
      activeFocusBodyEntry = bodyEntry;
    });

    if (activeFocusBodyEntry) {
      const focusBlend = clamp(1 - Math.exp(-delta * 4.6), 0.08, 0.24);
      const focusDistance = clamp(activeFocusBodyEntry.radius * 2.9 + 0.64, 1.2, 2.2);

      activeFocusBodyEntry.mesh.getWorldPosition(focusBodyPosition);
      focusOutward.copy(focusBodyPosition);

      if (focusOutward.lengthSq() <= 1e-6) {
        focusOutward.copy(homeForward).negate();
      } else {
        focusOutward.normalize();
      }

      focusDesiredPosition
        .copy(focusBodyPosition)
        .addScaledVector(focusOutward, focusDistance)
        .addScaledVector(worldUp, Math.max(0.08, activeFocusBodyEntry.radius * 0.2));

      currentCameraPosition.lerp(focusDesiredPosition, focusBlend);
      keyboardMoveControl.velocity.multiplyScalar(0.72);

      focusDesiredForward.copy(focusBodyPosition).sub(currentCameraPosition);
      if (focusDesiredForward.lengthSq() > 1e-6) {
        focusDesiredForward.normalize();
        cameraControl.yaw = lerpAngle(
          cameraControl.yaw,
          Math.atan2(focusDesiredForward.x, -focusDesiredForward.z),
          focusBlend,
        );
        cameraControl.pitch = THREE.MathUtils.lerp(
          cameraControl.pitch,
          Math.asin(clamp(focusDesiredForward.y, -1, 1)),
          focusBlend,
        );
      }

      if (
        currentCameraPosition.distanceToSquared(focusDesiredPosition) <= 0.01 &&
        focusDesiredForward.angleTo(homeForward) <= 0.04
      ) {
        activeFocusBodyEntry = null;
      }
    } else if (homeLockProgress > 0) {
      const positionLockBlend = clamp(
        1 - Math.exp(-delta * THREE.MathUtils.lerp(2.8, 10.4, homeLockProgress)),
        0.02,
        0.24,
      );

      currentCameraPosition.lerp(homeBasePosition, positionLockBlend);
      keyboardMoveControl.velocity.multiplyScalar(1 - clamp(homeLockProgress * 0.22, 0, 0.52));
    }

    if (currentCameraPosition.lengthSq() > 0) {
      const minimumHomeDistance = getMinimumHomeDistance(scrollProgress);

      if (currentCameraPosition.length() < minimumHomeDistance) {
        currentCameraPosition.setLength(minimumHomeDistance);
      } else if (currentCameraPosition.length() > 96) {
        currentCameraPosition.setLength(96);
      }
    }

    if (!isBodyFocusTransitionActive && !cameraControl.isCapturing && target.dragRecenter > 0) {
      homeCenterDirection.copy(origin).sub(currentCameraPosition);

      if (homeCenterDirection.lengthSq() > 1e-6) {
        homeCenterDirection.normalize();

        const autoYaw = Math.atan2(homeCenterDirection.x, -homeCenterDirection.z);
        const autoPitch = Math.asin(clamp(homeCenterDirection.y, -1, 1));
        const autoAimBlend = clamp(
          1 - Math.exp(-delta * THREE.MathUtils.lerp(4.2, 10.5, target.dragRecenter / 0.18)),
          0.03,
          0.24,
        );

        cameraControl.yaw = lerpAngle(cameraControl.yaw, autoYaw, autoAimBlend);
        cameraControl.pitch = THREE.MathUtils.lerp(cameraControl.pitch, autoPitch, autoAimBlend);
      }
    }

    syncHomeCameraBasis(cameraControl, worldUp, homeForward, right, upVector);

    keyboardMoveControl.offset.copy(currentCameraPosition).sub(homeBasePosition);

    observer.position.copy(currentCameraPosition);
    observer.velocity.set(0, 0, 0);
    observer.up.copy(upVector);
    observer.direction.copy(homeForward);
    cameraLookTarget.copy(observer.position).add(observer.direction);
    observer.lookAt(cameraLookTarget);
    observer.updateMatrixWorld();
    syncBodyDetailResolution();

    moveAnchor.copy(keyboardMoveControl.offset);
    pageHost?.style.setProperty('--story-reveal', target.storyReveal.toFixed(4));
    pageHost?.style.setProperty('--risk-visibility', target.riskVisibility.toFixed(4));

    return activeFocusBodyEntry;
  };

  return {
    update,
  };
};
