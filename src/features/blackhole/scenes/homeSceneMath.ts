import * as THREE from 'three';

import { smoothstep } from '@blackhole/math';
import type { SceneName, SceneTarget } from '@blackhole/types';

export const lerpAngle = (current: number, target: number, alpha: number) => {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
};

export const getBlackholeSceneTarget = (
  sceneName: SceneName,
  scrollProgress: number,
): SceneTarget => {
  if (sceneName === 'blog') {
    return {
      distance: 7.2,
      fov: 58,
      orbit: true,
      dragEnabled: false,
      dragRecenter: 0.18,
      keyboardRecenter: 0,
      keyboardEnabled: false,
      autoYaw: Math.PI,
      autoPitch: -0.04,
      forwardOffset: -18,
      verticalOffset: 0.18,
      rightOffset: 0,
      driftAmplitude: 0.015,
      starYawSpeed: 0.015,
      storyReveal: 1,
      riskVisibility: 0,
    };
  }

  if (sceneName !== 'home') {
    return {
      distance: 2.74,
      fov: 78,
      orbit: true,
      dragEnabled: false,
      dragRecenter: 0.16,
      keyboardRecenter: 0,
      keyboardEnabled: false,
      autoYaw: 1.82,
      autoPitch: 0.005,
      forwardOffset: 0.08,
      verticalOffset: 0,
      rightOffset: 1.72,
      driftAmplitude: 0.035,
      starYawSpeed: 0.006,
      storyReveal: 1,
      riskVisibility: 0,
    };
  }

  const approachProgress = smoothstep(0.03, 0.82, scrollProgress);
  const horizonLockProgress = smoothstep(0.14, 0.84, scrollProgress);
  const emergeProgress = smoothstep(0.72, 0.94, scrollProgress);
  const starfieldRotation = Math.max(emergeProgress, smoothstep(0.8, 1, scrollProgress));

  return {
    distance: THREE.MathUtils.lerp(10, 1.08, approachProgress),
    fov: THREE.MathUtils.lerp(90, 112, horizonLockProgress * (1 - emergeProgress * 0.3)),
    orbit: false,
    dragEnabled: true,
    dragRecenter: THREE.MathUtils.lerp(0, 0.18, horizonLockProgress),
    keyboardRecenter: THREE.MathUtils.lerp(0, 0.14, horizonLockProgress),
    keyboardEnabled: true,
    autoYaw: 0,
    autoPitch: 0,
    forwardOffset: THREE.MathUtils.lerp(0, 14, emergeProgress),
    verticalOffset: THREE.MathUtils.lerp(0, -0.85, emergeProgress),
    rightOffset: 0,
    driftAmplitude: 0.72 * starfieldRotation,
    starYawSpeed: 0,
    storyReveal: smoothstep(0.72, 0.96, scrollProgress),
    riskVisibility:
      smoothstep(0.22, 0.38, scrollProgress) * (1 - smoothstep(0.56, 0.72, scrollProgress)),
  };
};

export const getMinimumHomeDistance = (scrollProgress: number) =>
  THREE.MathUtils.lerp(2.1, 1.06, smoothstep(0.16, 0.88, scrollProgress));
