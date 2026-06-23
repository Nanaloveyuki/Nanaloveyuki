import * as THREE from 'three';

import { createOrbitLine, getOrbitBand, hashString } from '@blackhole/math';
import type { FriendPlanet, PlanetEntry } from '@blackhole/types';

import {
  buildPlanetEntry,
  getPlanetAxialTilt,
  getPlanetOrbitRadius,
  getPlanetOrbitSpeed,
  getPlanetRadius,
  getPlanetRotationSpeed,
} from './planetFactories';

export type PlanetSystem = {
  planetGroup: THREE.Group;
  orbitGroup: THREE.Group;
  entries: PlanetEntry[];
  clickableMeshes: THREE.Mesh[];
  glowTextures: Map<FriendPlanet['type'], THREE.Texture>;
  dispose: () => void;
  build: (friends: FriendPlanet[]) => void;
  update: (delta: number, selectedPlanetEntry: PlanetEntry | null) => void;
  updateUniforms: (time: number, origin: THREE.Vector3) => void;
  getEntryByMesh: (mesh?: THREE.Mesh) => PlanetEntry | null;
};

export const createPlanetSystem = (
  overlayScene: THREE.Scene,
  orbitScene: THREE.Scene,
): PlanetSystem => {
  const planetGroup = new THREE.Group();
  const orbitGroup = new THREE.Group();
  overlayScene.add(planetGroup);
  orbitScene.add(orbitGroup);

  const entries: PlanetEntry[] = [];
  const clickableMeshes: THREE.Mesh[] = [];
  const glowTextures = new Map<FriendPlanet['type'], THREE.Texture>();
  const shellScaleTarget = new THREE.Vector3();

  const build = (friends: FriendPlanet[]) => {
    const orbitBaseRadii = [4.8, 5.8, 6.9, 8.1];
    const orbitBandOffsets = [0, 0, 0, 0];

    friends.forEach((friend, index) => {
      const hash = hashString(friend.name);
      const band = getOrbitBand(friend.name);
      const fallbackOrbitRadius =
        orbitBaseRadii[band] + orbitBandOffsets[band] * 0.48 + ((hash % 11) / 10) * 0.12;
      orbitBandOffsets[band] += 1;
      const fallbackOrbitSpeed = 0.008 + (hash % 5) * 0.0016 + band * 0.0012;
      const defaultSize = 0.2 + ((hash >> 3) % 6) * 0.024 + (friend.type === 'hot' ? 0.03 : 0);
      const size = getPlanetRadius(friend, defaultSize);
      const orbitRadius = getPlanetOrbitRadius(friend, fallbackOrbitRadius);
      const orbitSpeed = getPlanetOrbitSpeed(friend, fallbackOrbitSpeed);
      const rotationSpeed = getPlanetRotationSpeed(friend, 0.06 + ((hash >> 2) % 7) * 0.018);
      const axialTilt = getPlanetAxialTilt(friend);

      const entry = buildPlanetEntry({
        friend,
        index,
        hash,
        size,
        orbitRadius,
        orbitSpeed,
        rotationSpeed,
        axialTilt,
        planetGroup,
        orbitGroup,
        glowTextures,
      });

      const orbitLine = createOrbitLine(orbitRadius);
      orbitLine.renderOrder = 2;
      orbitLine.frustumCulled = false;
      orbitLine.visible = friend.planet?.orbit?.is_show ?? true;
      entry.orbitOccluder.parent?.add(orbitLine);

      entries.push(entry);
      clickableMeshes.push(entry.mesh);
    });
  };

  const update = (delta: number, selectedPlanetEntry: PlanetEntry | null) => {
    orbitGroup.visible = true;

    entries.forEach((planetEntry) => {
      const angle =
        delta >= 0 ? (planetEntry.mesh.userData.timeAngle ?? planetEntry.phase) : planetEntry.phase;
      const nextAngle = angle + delta * planetEntry.orbitSpeed;
      planetEntry.mesh.userData.timeAngle = nextAngle;

      planetEntry.anchor.position.set(
        Math.cos(nextAngle) * planetEntry.orbitRadius,
        0,
        Math.sin(nextAngle) * planetEntry.orbitRadius,
      );
      planetEntry.mesh.rotation.y += delta * planetEntry.rotationSpeed;
      planetEntry.shell.position.set(0, 0, 0);
      planetEntry.glow.position.set(0, 0, 0);
      planetEntry.ring?.position.set(0, 0, 0);
      planetEntry.orbitOccluder.position.copy(planetEntry.anchor.position);

      const shellMaterial = planetEntry.shell.material;
      const glowMaterial = planetEntry.glow.material;
      const isSelected = planetEntry === selectedPlanetEntry;

      shellScaleTarget.setScalar(isSelected ? 1.1 : 1);
      planetEntry.shell.scale.lerp(shellScaleTarget, isSelected ? 0.2 : 0.14);

      if (shellMaterial instanceof THREE.MeshBasicMaterial) {
        shellMaterial.color.copy(
          isSelected
            ? planetEntry.shellBaseColor.clone().lerp(new THREE.Color('#ffffff'), 0.5)
            : planetEntry.shellBaseColor,
        );
        shellMaterial.opacity = THREE.MathUtils.lerp(
          shellMaterial.opacity,
          isSelected
            ? Math.max(0.28, planetEntry.shellBaseOpacity + 0.08)
            : planetEntry.shellBaseOpacity,
          isSelected ? 0.2 : 0.14,
        );
      }

      if (glowMaterial instanceof THREE.SpriteMaterial) {
        glowMaterial.opacity = THREE.MathUtils.lerp(
          glowMaterial.opacity,
          isSelected
            ? Math.max(0.18, planetEntry.glowBaseOpacity - 0.06)
            : planetEntry.glowBaseOpacity,
          isSelected ? 0.18 : 0.12,
        );
      }

      const ringMaterial = planetEntry.ring?.material;
      if (ringMaterial instanceof THREE.MeshBasicMaterial) {
        const baseOpacity = (planetEntry.ring?.userData.baseOpacity as number | undefined) ?? 0.48;
        ringMaterial.opacity = THREE.MathUtils.lerp(
          ringMaterial.opacity,
          isSelected ? Math.min(baseOpacity + 0.14, 0.72) : baseOpacity,
          isSelected ? 0.16 : 0.12,
        );
      }
    });
  };

  const updateUniforms = (time: number, origin: THREE.Vector3) => {
    entries.forEach((planetEntry) => {
      const planetMaterial = planetEntry.mesh.material;

      if (!(planetMaterial instanceof THREE.ShaderMaterial)) {
        return;
      }

      const lightDirection = origin
        .clone()
        .sub(planetEntry.mesh.getWorldPosition(new THREE.Vector3()))
        .normalize();
      planetMaterial.uniforms.lightDirection.value.copy(lightDirection);
      planetMaterial.uniforms.time.value = time + planetEntry.hueShift * 20;
    });
  };

  const getEntryByMesh = (mesh?: THREE.Mesh) =>
    entries.find((planetEntry) => planetEntry.mesh === mesh) ?? null;

  const dispose = () => {
    entries.forEach((planetEntry) => {
      planetEntry.mesh.geometry.dispose();
      if (planetEntry.mesh.material instanceof THREE.Material) {
        planetEntry.mesh.material.dispose();
      }
      planetEntry.shell.geometry.dispose();
      if (planetEntry.shell.material instanceof THREE.Material) {
        planetEntry.shell.material.dispose();
      }
      planetEntry.glow.material.dispose();
      planetEntry.ring?.geometry.dispose();
      if (planetEntry.ring?.material instanceof THREE.Material) {
        planetEntry.ring.material.dispose();
      }
      planetEntry.orbitOccluder.geometry.dispose();
      if (planetEntry.orbitOccluder.material instanceof THREE.Material) {
        planetEntry.orbitOccluder.material.dispose();
      }
    });

    glowTextures.forEach((texture) => texture.dispose());
    overlayScene.remove(planetGroup);
    orbitScene.remove(orbitGroup);
  };

  return {
    planetGroup,
    orbitGroup,
    entries,
    clickableMeshes,
    glowTextures,
    dispose,
    build,
    update,
    updateUniforms,
    getEntryByMesh,
  };
};
