import * as THREE from 'three';

import { CameraDragControls, KeyboardMoveControls } from '@blackhole/core/controls';
import { Observer } from '@blackhole/core/observer';
import type { SceneTarget } from '@blackhole/types';

type OrbitPresentationControllerParams = {
  delta: number;
  time: number;
  target: SceneTarget;
  pageHost: HTMLElement | null;
  observer: Observer;
  observerBaseUp: THREE.Vector3;
  origin: THREE.Vector3;
  moveAnchor: THREE.Vector3;
  cameraControl: CameraDragControls;
  keyboardMoveControl: KeyboardMoveControls;
};

export const createOrbitPresentationController = () => {
  const baseForward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const upVector = new THREE.Vector3();
  const orbitYawQuaternion = new THREE.Quaternion();
  const orbitPitchQuaternion = new THREE.Quaternion();
  const yawQuaternion = new THREE.Quaternion();
  const pitchQuaternion = new THREE.Quaternion();
  const orbitUpAxis = new THREE.Vector3();
  const orbitPitchAxis = new THREE.Vector3();
  const rotatedPosition = new THREE.Vector3();
  const rotatedVelocity = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const yawAdjustedLookTarget = new THREE.Vector3();
  const yawAdjustedRight = new THREE.Vector3();
  const pitchAxis = new THREE.Vector3();

  const update = ({
    delta,
    time,
    target,
    pageHost,
    observer,
    observerBaseUp,
    origin,
    moveAnchor,
    cameraControl,
    keyboardMoveControl,
  }: OrbitPresentationControllerParams) => {
    orbitUpAxis.copy(observerBaseUp).normalize();
    rotatedPosition.copy(observer.position);
    rotatedVelocity.copy(observer.velocity);

    orbitYawQuaternion.setFromAxisAngle(orbitUpAxis, target.autoYaw);
    rotatedPosition.applyQuaternion(orbitYawQuaternion);
    rotatedVelocity.applyQuaternion(orbitYawQuaternion);

    orbitPitchAxis.crossVectors(orbitUpAxis, rotatedPosition).normalize();
    if (orbitPitchAxis.lengthSq() > 0) {
      orbitPitchQuaternion.setFromAxisAngle(orbitPitchAxis, target.autoPitch);
      rotatedPosition.applyQuaternion(orbitPitchQuaternion);
      rotatedVelocity.applyQuaternion(orbitPitchQuaternion);
    }

    observer.position.copy(rotatedPosition);
    observer.velocity.copy(rotatedVelocity);
    observer.up.copy(observerBaseUp).applyQuaternion(orbitYawQuaternion);
    if (orbitPitchAxis.lengthSq() > 0) {
      observer.up.applyQuaternion(orbitPitchQuaternion);
    }

    rotatedPosition.add(keyboardMoveControl.offset);
    observer.position.copy(rotatedPosition);

    upVector.copy(observer.up).normalize();
    baseForward.copy(origin).sub(observer.position).normalize();
    right.crossVectors(baseForward, upVector).normalize();

    cameraControl.setEnabled(target.dragEnabled);
    cameraControl.update(target.dragRecenter);

    const driftOffset = target.rightOffset + Math.sin(time * 0.18) * target.driftAmplitude;
    const starYawOffset = time * target.starYawSpeed;
    const yawInfluence = target.dragEnabled ? 1 : 0;
    const yawOffset = cameraControl.yaw * yawInfluence;
    const pitchOffset = cameraControl.pitch * yawInfluence;

    lookTarget.copy(origin);
    lookTarget.addScaledVector(baseForward, target.forwardOffset);
    lookTarget.addScaledVector(upVector, target.verticalOffset);
    lookTarget.addScaledVector(right, driftOffset);
    lookTarget.add(moveAnchor);
    lookTarget.sub(observer.position);

    yawQuaternion.setFromAxisAngle(upVector, yawOffset + starYawOffset);
    yawAdjustedLookTarget.copy(lookTarget).applyQuaternion(yawQuaternion);
    yawAdjustedRight.copy(right).applyQuaternion(yawQuaternion).normalize();
    pitchAxis.copy(yawAdjustedRight);
    pitchQuaternion.setFromAxisAngle(pitchAxis, pitchOffset);

    lookTarget.copy(yawAdjustedLookTarget);
    if (pitchAxis.lengthSq() > 0) {
      lookTarget.applyQuaternion(pitchQuaternion);
    }

    observer.direction.copy(lookTarget.normalize());
    cameraLookTarget.copy(observer.position).add(observer.direction);
    observer.lookAt(cameraLookTarget);
    observer.updateMatrixWorld();

    keyboardMoveControl.update(
      delta,
      observer.distance,
      target.keyboardEnabled,
      target.keyboardRecenter,
      {
        forward: observer.direction,
        right,
        up: upVector,
      },
    );

    moveAnchor.copy(keyboardMoveControl.offset);
    pageHost?.style.setProperty('--story-reveal', target.storyReveal.toFixed(4));
    pageHost?.style.setProperty('--risk-visibility', target.riskVisibility.toFixed(4));
  };

  return {
    update,
  };
};
