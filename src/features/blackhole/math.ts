import * as THREE from 'three';

import type { PerformanceConfig } from '@blackhole/types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const smoothstep = (start: number, end: number, value: number) => {
  const x = clamp((value - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  resolution: 1.0,
  quality: 'medium',
};

export const getMeasuredPerformanceTarget = (averageFps: number): PerformanceConfig => {
  if (averageFps >= 46) {
    return { resolution: 1.0, quality: 'medium' };
  }

  if (averageFps >= 32) {
    return { resolution: 0.75, quality: 'medium' };
  }

  return { resolution: 0.75, quality: 'low' };
};

export const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

export const getInitialKey = (name: string) => {
  const firstCharacter = name.trim().charAt(0).toUpperCase();

  if (firstCharacter >= 'A' && firstCharacter <= 'Z') {
    return firstCharacter;
  }

  return firstCharacter || '#';
};

export const getOrbitBand = (name: string) => {
  const key = getInitialKey(name);

  if (key >= 'A' && key <= 'F') return 0;
  if (key >= 'G' && key <= 'L') return 1;
  if (key >= 'M' && key <= 'R') return 2;
  return 3;
};

export const createOrbitLine = (radius: number) => {
  const points: THREE.Vector3[] = [];

  for (let step = 0; step <= 128; step += 1) {
    const angle = (step / 128) * Math.PI * 2;
    const point = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

    points.push(point);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color('#c6ccd6'),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
};
