import * as THREE from 'three';

import { createOrbitLine, getOrbitBand, hashString } from '@blackhole/math';
import type { LegacyFriendPlanet } from '@blackhole/types';

import {
  adaptLegacyFriendPlanetsToBodyDefinitions,
  buildBodyEntry,
  resolveBodyPresentationSource,
} from './bodyFactories';
import {
  getBodyAxialTilt,
  getBodyOrbitRadius,
  getBodyOrbitSpeed,
  getBodyRadius,
  getBodyRotationSpeed,
} from './bodyDerivedState';
import type { BodyPresentationType } from './bodyPresentation';
import type {
  BodyDefinition,
  BodyDefinitionMap,
  BodyDerivationContext,
  BodyEntry,
} from './bodyTypes';

export type BodySystem = {
  bodyGroup: THREE.Group;
  orbitGroup: THREE.Group;
  bodyEntries: BodyEntry[];
  clickableBodies: THREE.Mesh[];
  glowTextures: Map<BodyPresentationType, THREE.Texture>;
  dispose: () => void;
  buildBodies: (bodyDefinitions: BodyDefinition[]) => void;
  buildFromLegacyFriendPlanets: (legacyFriends: LegacyFriendPlanet[]) => void;
  update: (delta: number, selectedBodyEntry: BodyEntry | null) => void;
  updateUniforms: (time: number, origin: THREE.Vector3) => void;
  getEntryByMesh: (mesh?: THREE.Mesh) => BodyEntry | null;
};

export const createBodySystem = (
  overlayScene: THREE.Scene,
  orbitScene: THREE.Scene,
): BodySystem => {
  const bodyGroup = new THREE.Group();
  const orbitGroup = new THREE.Group();
  overlayScene.add(bodyGroup);
  orbitScene.add(orbitGroup);

  const bodyEntries: BodyEntry[] = [];
  const clickableBodies: THREE.Mesh[] = [];
  const glowTextures = new Map<BodyPresentationType, THREE.Texture>();
  const shellScaleTarget = new THREE.Vector3();

  const getOrbitStateAccent = (bodyEntry: BodyEntry) => {
    if (bodyEntry.derivedState.orbitStability === 'inside-isco') {
      return {
        color: new THREE.Color('#ff6b6b'),
        orbitOpacity: 0.58,
        shellMix: 0.92,
        glowMix: 0.86,
        glowOpacityBoost: 0.18,
      };
    }

    if (bodyEntry.derivedState.orbitStability === 'near-isco') {
      return {
        color: new THREE.Color('#ffb86b'),
        orbitOpacity: 0.46,
        shellMix: 0.72,
        glowMix: 0.62,
        glowOpacityBoost: 0.12,
      };
    }

    if (bodyEntry.derivedState.habitableZoneStatus === 'inside') {
      return {
        color: new THREE.Color('#7ce7a2'),
        orbitOpacity: 0.34,
        shellMix: 0.52,
        glowMix: 0.4,
        glowOpacityBoost: 0.08,
      };
    }

    if (bodyEntry.derivedState.habitableZoneStatus === 'too-hot') {
      return {
        color: new THREE.Color('#ff9d6c'),
        orbitOpacity: 0.32,
        shellMix: 0.46,
        glowMix: 0.34,
        glowOpacityBoost: 0.06,
      };
    }

    if (bodyEntry.derivedState.habitableZoneStatus === 'too-cold') {
      return {
        color: new THREE.Color('#7ebdff'),
        orbitOpacity: 0.32,
        shellMix: 0.42,
        glowMix: 0.34,
        glowOpacityBoost: 0.06,
      };
    }

    return {
      color: new THREE.Color('#c6ccd6'),
      orbitOpacity: 0.18,
      shellMix: 0,
      glowMix: 0,
      glowOpacityBoost: 0,
    };
  };

  const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
      return;
    }

    material.dispose();
  };

  const disposeGroupResources = (group: THREE.Group) => {
    group.traverse((object3d) => {
      const geometry = (object3d as { geometry?: THREE.BufferGeometry }).geometry;
      const material = (object3d as { material?: THREE.Material | THREE.Material[] }).material;

      geometry?.dispose();

      if (material) {
        disposeMaterial(material);
      }
    });

    group.clear();
  };

  const resetBodies = () => {
    disposeGroupResources(bodyGroup);
    disposeGroupResources(orbitGroup);
    bodyEntries.length = 0;
    clickableBodies.length = 0;
    glowTextures.forEach((texture) => texture.dispose());
    glowTextures.clear();
  };

  const orderBodyDefinitionsByHierarchy = (bodyDefinitions: BodyDefinition[]) => {
    const bodyDefinitionsById: BodyDefinitionMap = new Map(
      bodyDefinitions.map((bodyDefinition) => [bodyDefinition.body.id, bodyDefinition]),
    );
    const orderedBodyDefinitions: BodyDefinition[] = [];
    const permanentIds = new Set<string>();
    const temporaryIds = new Set<string>();

    const visit = (bodyDefinition: BodyDefinition) => {
      const bodyId = bodyDefinition.body.id;

      if (permanentIds.has(bodyId)) {
        return;
      }

      if (temporaryIds.has(bodyId)) {
        orderedBodyDefinitions.push(bodyDefinition);
        return;
      }

      temporaryIds.add(bodyId);

      const parentId = bodyDefinition.body.orbit?.parentId;
      if (parentId) {
        const parentBodyDefinition = bodyDefinitionsById.get(parentId);
        if (parentBodyDefinition) {
          visit(parentBodyDefinition);
        }
      }

      temporaryIds.delete(bodyId);
      permanentIds.add(bodyId);
      orderedBodyDefinitions.push(bodyDefinition);
    };

    bodyDefinitions.forEach(visit);
    return orderedBodyDefinitions;
  };

  const buildBodies = (bodyDefinitions: BodyDefinition[]) => {
    resetBodies();

    const orbitBaseRadii = [4.8, 5.8, 6.9, 8.1];
    const orbitBandOffsets = [0, 0, 0, 0];
    const orderedBodyDefinitions = orderBodyDefinitionsByHierarchy(bodyDefinitions);
    const bodyDefinitionsById: BodyDefinitionMap = new Map(
      orderedBodyDefinitions.map((bodyDefinition) => [bodyDefinition.body.id, bodyDefinition]),
    );
    const bodyEntriesById = new Map<string, BodyEntry>();
    const derivationContext: BodyDerivationContext = {
      bodyDefinitionsById,
    };

    orderedBodyDefinitions.forEach((bodyDefinition, index) => {
      const presentation = resolveBodyPresentationSource(bodyDefinition);
      const hash = hashString(presentation.name);
      const band = getOrbitBand(presentation.name);
      const fallbackOrbitRadius =
        orbitBaseRadii[band] + orbitBandOffsets[band] * 0.48 + ((hash % 11) / 10) * 0.12;
      orbitBandOffsets[band] += 1;
      const fallbackOrbitSpeed = 0.008 + (hash % 5) * 0.0016 + band * 0.0012;
      const defaultSize =
        0.2 + ((hash >> 3) % 6) * 0.024 + (presentation.type === 'hot' ? 0.03 : 0);
      const size = getBodyRadius(bodyDefinition, defaultSize, derivationContext);
      const orbitRadius = getBodyOrbitRadius(
        bodyDefinition,
        fallbackOrbitRadius,
        derivationContext,
      );
      const orbitSpeed = getBodyOrbitSpeed(bodyDefinition, fallbackOrbitSpeed, derivationContext);
      const rotationSpeed = getBodyRotationSpeed(
        bodyDefinition,
        0.06 + ((hash >> 2) % 7) * 0.018,
        derivationContext,
      );
      const axialTilt = getBodyAxialTilt(bodyDefinition, derivationContext);

      const entry = buildBodyEntry({
        bodyDefinition,
        derivationContext,
        index,
        hash,
        size,
        orbitRadius,
        orbitSpeed,
        rotationSpeed,
        axialTilt,
        bodyGroup,
        orbitGroup,
        glowTextures,
      });

      entry.mesh.userData.bodyPresentation = presentation;

      const orbitLine = createOrbitLine(orbitRadius);
      const orbitLineMaterial = orbitLine.material;
      const orbitAccent = getOrbitStateAccent(entry);
      if (orbitLineMaterial instanceof THREE.LineBasicMaterial) {
        orbitLineMaterial.color.copy(orbitAccent.color);
        orbitLineMaterial.opacity = orbitAccent.orbitOpacity;
      }
      orbitLine.renderOrder = 2;
      orbitLine.frustumCulled = false;
      orbitLine.visible = entry.body.orbit?.visible ?? true;

      const parentEntry = bodyDefinition.body.orbit?.parentId
        ? bodyEntriesById.get(bodyDefinition.body.orbit.parentId)
        : null;
      if (parentEntry) {
        parentEntry.anchor.add(entry.pivot);
        parentEntry.orbitAnchor.add(entry.orbitPivot);
      }

      entry.orbitPivot.add(orbitLine);

      bodyEntries.push(entry);
      bodyEntriesById.set(bodyDefinition.body.id, entry);
      clickableBodies.push(entry.mesh);
    });
  };

  const buildFromLegacyFriendPlanets = (legacyFriends: LegacyFriendPlanet[]) => {
    buildBodies(adaptLegacyFriendPlanetsToBodyDefinitions(legacyFriends));
  };

  const update = (delta: number, selectedBodyEntry: BodyEntry | null) => {
    orbitGroup.visible = true;

    bodyEntries.forEach((bodyEntry) => {
      const angle =
        delta >= 0 ? (bodyEntry.mesh.userData.timeAngle ?? bodyEntry.phase) : bodyEntry.phase;
      const nextAngle = angle + delta * bodyEntry.orbitSpeed;
      bodyEntry.mesh.userData.timeAngle = nextAngle;

      bodyEntry.anchor.position.set(
        Math.cos(nextAngle) * bodyEntry.orbitRadius,
        0,
        Math.sin(nextAngle) * bodyEntry.orbitRadius,
      );
      bodyEntry.orbitAnchor.position.copy(bodyEntry.anchor.position);
      bodyEntry.mesh.rotation.y += delta * bodyEntry.rotationSpeed;
      bodyEntry.shell.position.set(0, 0, 0);
      bodyEntry.glow.position.set(0, 0, 0);
      bodyEntry.ring?.position.set(0, 0, 0);
      bodyEntry.orbitOccluder.position.set(0, 0, 0);

      const shellMaterial = bodyEntry.shell.material;
      const glowMaterial = bodyEntry.glow.material;
      const isSelected = bodyEntry === selectedBodyEntry;
      const orbitAccent = getOrbitStateAccent(bodyEntry);

      bodyEntry.orbitPivot.children.forEach((child) => {
        if (!(child instanceof THREE.LineLoop)) {
          return;
        }

        const orbitLineMaterial = child.material;
        if (!(orbitLineMaterial instanceof THREE.LineBasicMaterial)) {
          return;
        }

        orbitLineMaterial.color.lerp(orbitAccent.color, isSelected ? 0.16 : 0.08);
        orbitLineMaterial.opacity = THREE.MathUtils.lerp(
          orbitLineMaterial.opacity,
          isSelected ? Math.min(orbitAccent.orbitOpacity + 0.18, 0.72) : orbitAccent.orbitOpacity,
          isSelected ? 0.22 : 0.16,
        );
      });

      shellScaleTarget.setScalar(isSelected ? 1.1 : 1);
      bodyEntry.shell.scale.lerp(shellScaleTarget, isSelected ? 0.2 : 0.14);

      if (shellMaterial instanceof THREE.MeshBasicMaterial) {
        shellMaterial.color.copy(
          isSelected
            ? bodyEntry.shellBaseColor.clone().lerp(new THREE.Color('#ffffff'), 0.5)
            : bodyEntry.shellBaseColor.clone().lerp(orbitAccent.color, orbitAccent.shellMix),
        );
        shellMaterial.opacity = THREE.MathUtils.lerp(
          shellMaterial.opacity,
          isSelected
            ? Math.max(0.32, bodyEntry.shellBaseOpacity + 0.12 + orbitAccent.glowOpacityBoost * 0.5)
            : Math.max(
                bodyEntry.shellBaseOpacity,
                bodyEntry.shellBaseOpacity + orbitAccent.glowOpacityBoost * 0.3,
              ),
          isSelected ? 0.22 : 0.16,
        );
      }

      if (glowMaterial instanceof THREE.SpriteMaterial) {
        glowMaterial.color.copy(
          isSelected
            ? bodyEntry.glowBaseColor.clone().lerp(new THREE.Color('#ffffff'), 0.42)
            : bodyEntry.glowBaseColor.clone().lerp(orbitAccent.color, orbitAccent.glowMix),
        );
        glowMaterial.opacity = THREE.MathUtils.lerp(
          glowMaterial.opacity,
          isSelected
            ? Math.max(0.24, bodyEntry.glowBaseOpacity + orbitAccent.glowOpacityBoost + 0.08)
            : Math.max(
                bodyEntry.glowBaseOpacity,
                bodyEntry.glowBaseOpacity + orbitAccent.glowOpacityBoost,
              ),
          isSelected ? 0.22 : 0.16,
        );
      }

      const ringMaterial = bodyEntry.ring?.material;
      if (ringMaterial instanceof THREE.ShaderMaterial) {
        const baseOpacity = (bodyEntry.ring?.userData.baseOpacity as number | undefined) ?? 0.48;
        const baseBrightness = (bodyEntry.ring?.userData.baseBrightness as number | undefined) ?? 1;
        ringMaterial.uniforms.opacity.value = THREE.MathUtils.lerp(
          ringMaterial.uniforms.opacity.value,
          isSelected ? Math.min(baseOpacity + 0.16, 0.8) : baseOpacity,
          isSelected ? 0.16 : 0.12,
        );
        ringMaterial.uniforms.brightness.value = THREE.MathUtils.lerp(
          ringMaterial.uniforms.brightness.value,
          isSelected ? baseBrightness + 0.18 : baseBrightness,
          isSelected ? 0.16 : 0.12,
        );
      }
    });
  };

  const updateUniforms = (time: number, origin: THREE.Vector3) => {
    bodyEntries.forEach((bodyEntry) => {
      const bodyMaterial = bodyEntry.mesh.material;

      if (!(bodyMaterial instanceof THREE.ShaderMaterial)) {
        return;
      }

      const lightDirection = origin
        .clone()
        .sub(bodyEntry.mesh.getWorldPosition(new THREE.Vector3()))
        .normalize();
      bodyMaterial.uniforms.lightDirection.value.copy(lightDirection);
      bodyMaterial.uniforms.time.value = time + bodyEntry.hueShift * 20;

      const ringMaterial = bodyEntry.ring?.material;
      if (ringMaterial instanceof THREE.ShaderMaterial) {
        ringMaterial.uniforms.time.value = time + bodyEntry.hueShift * 11;
      }
    });
  };

  const getEntryByMesh = (mesh?: THREE.Mesh) =>
    bodyEntries.find((bodyEntry) => bodyEntry.mesh === mesh) ?? null;

  const dispose = () => {
    resetBodies();
    overlayScene.remove(bodyGroup);
    orbitScene.remove(orbitGroup);
  };

  return {
    bodyGroup,
    orbitGroup,
    bodyEntries,
    clickableBodies,
    glowTextures,
    dispose,
    buildBodies,
    buildFromLegacyFriendPlanets,
    update,
    updateUniforms,
    getEntryByMesh,
  };
};
