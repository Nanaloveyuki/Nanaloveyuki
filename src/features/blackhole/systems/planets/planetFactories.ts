import * as THREE from 'three';

import { clamp } from '@blackhole/math';
import type { FriendPlanet, FriendPlanetType, PlanetEntry } from '@blackhole/types';

import {
  getPlanetAppearanceProfile,
  getPlanetColor,
  getPlanetTemperatureBand,
} from './planetAppearance';

export const getPlanetGlowTexture = (
  glowTextures: Map<FriendPlanetType, THREE.Texture>,
  type: FriendPlanetType,
) => {
  const existing = glowTextures.get(type);
  if (existing) {
    return existing;
  }

  const palette: Record<FriendPlanetType, string> = {
    cold: '#cfe9ff',
    cool: '#ffc28d',
    warm: '#9fd2ff',
    hot: '#ffb067',
  };

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (!context) {
    const fallback = new THREE.Texture();
    glowTextures.set(type, fallback);
    return fallback;
  }

  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.36, `${palette[type]}cc`);
  gradient.addColorStop(0.68, `${palette[type]}40`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  glowTextures.set(type, texture);
  return texture;
};

export const getPlanetRadius = (friend: FriendPlanet, fallbackRadius: number) => {
  const explicitRadius = friend.planet?.radius;

  if (typeof explicitRadius === 'number' && Number.isFinite(explicitRadius) && explicitRadius > 0) {
    return THREE.MathUtils.clamp(explicitRadius / 22000, 0.16, 0.88);
  }

  return fallbackRadius;
};

export const getPlanetOrbitRadius = (friend: FriendPlanet, fallbackOrbitRadius: number) => {
  const distance = friend.planet?.orbit?.distance_from_star;
  const unit = friend.planet?.orbit?.distance_unit ?? 'AU';

  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0) {
    return fallbackOrbitRadius;
  }

  const normalizedAu = unit === 'km' ? distance / 149_597_870.7 : distance;
  return clamp(3.9 + normalizedAu * 1.95, 4.2, 11.8);
};

export const getPlanetOrbitSpeed = (friend: FriendPlanet, fallbackOrbitSpeed: number) => {
  const period = friend.planet?.orbit?.period;
  const unit = friend.planet?.orbit?.period_unit ?? 'days';

  if (typeof period !== 'number' || !Number.isFinite(period) || period <= 0) {
    return fallbackOrbitSpeed;
  }

  const periodDays = unit === 'years' ? period * 365 : period;
  const normalizedDays = clamp(periodDays, 40, 5000);
  return clamp(0.012 * Math.pow(365 / normalizedDays, 0.34), 0.0032, 0.0135);
};

export const getPlanetRotationSpeed = (friend: FriendPlanet, fallbackRotationSpeed: number) => {
  const value = friend.planet?.physics?.rotation_speed;
  const unit = friend.planet?.physics?.rotation_unit ?? 'hours';

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallbackRotationSpeed;
  }

  const periodSeconds = unit === 'days' ? value * 86400 : unit === 'seconds' ? value : value * 3600;

  return clamp(((Math.PI * 2) / periodSeconds) * 1200, 0.02, 0.45);
};

export const getPlanetAxialTilt = (friend: FriendPlanet) => {
  const axialTilt = friend.planet?.physics?.axial_tilt;

  if (typeof axialTilt !== 'number' || !Number.isFinite(axialTilt)) {
    return 0;
  }

  return THREE.MathUtils.degToRad(clamp(axialTilt, -65, 65));
};

export const getPlanetShellAppearance = (friend: FriendPlanet, type: FriendPlanetType) => {
  const defaultShellColors: Record<FriendPlanetType, string> = {
    cold: '#e6f4ff',
    cool: '#ffd3ae',
    warm: '#d9efff',
    hot: '#ffd4aa',
  };

  const appearance = getPlanetAppearanceProfile(friend);
  const surfaceColor = getPlanetColor(friend.planet?.color, defaultShellColors[type]);
  const atmosphereVisible = appearance.atmosphereVisible;
  const pressure = friend.planet?.atmosphere?.pressure ?? 0;
  const shellOpacity = atmosphereVisible
    ? clamp(0.08 + pressure * 0.025 + appearance.atmosphereIntensity * 0.12, 0.1, 0.28)
    : 0.05;
  const glowOpacity = clamp(
    0.15 +
      (atmosphereVisible ? appearance.atmosphereIntensity * 0.16 : 0) +
      (type === 'hot' ? 0.06 : 0),
    0.16,
    0.38,
  );

  return {
    color: appearance.atmosphereColor.clone().lerp(surfaceColor, atmosphereVisible ? 0.36 : 0.62),
    shellOpacity,
    glowOpacity,
  };
};

export const createPlanetMaterial = (friend: FriendPlanet) => {
  const type = friend.type;
  const palettes: Record<
    FriendPlanetType,
    {
      emission: string;
      emissionStrength: number;
    }
  > = {
    cold: { emission: '#99d9ff', emissionStrength: 0.02 },
    cool: { emission: '#ffb36b', emissionStrength: 0.03 },
    warm: { emission: '#7ec8ff', emissionStrength: 0.01 },
    hot: { emission: '#ff7a2f', emissionStrength: 0.18 },
  };

  const palette = palettes[type];
  const appearance = getPlanetAppearanceProfile(friend);
  const surfaceColor = appearance.baseColor;
  const shadowColor = appearance.shadowColor;
  const atmosphereVisible = appearance.atmosphereVisible;
  const temperatureBand = getPlanetTemperatureBand(friend.planet);
  const heatMix = temperatureBand
    ? clamp((temperatureBand.averageKelvin - 240) / 1200, 0, 1)
    : type === 'hot'
      ? 1
      : type === 'warm'
        ? 0.3
        : 0.12;
  const emissionStrength = clamp(
    palette.emissionStrength + heatMix * 0.12 + (atmosphereVisible ? 0.01 : 0),
    0.005,
    0.22,
  );
  const dayColorA = appearance.waterVisible
    ? appearance.waterColor
        .clone()
        .lerp(new THREE.Color('#ffffff'), 0.18 + appearance.waterGloss * 0.12)
    : surfaceColor.clone().lerp(new THREE.Color('#ffffff'), 0.18);
  const dayColorB = appearance.landColor.clone().lerp(shadowColor, 0.22);
  const nightColor = shadowColor.clone().multiplyScalar(0.96);
  const rimColor = appearance.atmosphereColor
    .clone()
    .lerp(
      new THREE.Color('#ffffff'),
      atmosphereVisible ? 0.32 + appearance.atmosphereIntensity * 0.3 : 0.14,
    );
  const detailColorA = appearance.landSecondaryColor
    .clone()
    .lerp(new THREE.Color('#fff4d6'), 0.12 + heatMix * 0.1);
  const detailColorB = shadowColor.clone().lerp(appearance.landColor, 0.26);
  const emissionColor = getPlanetColor(friend.planet?.ring?.color, palette.emission).lerp(
    surfaceColor,
    0.34,
  );

  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      lightDirection: { value: new THREE.Vector3(0, 0, -1) },
      time: { value: 0 },
      dayColorA: { value: dayColorA },
      dayColorB: { value: dayColorB },
      nightColor: { value: nightColor },
      rimColor: { value: rimColor },
      detailColorA: { value: detailColorA },
      detailColorB: { value: detailColorB },
      emissionColor: { value: emissionColor },
      emissionStrength: { value: emissionStrength },
      waterColor: { value: appearance.waterColor },
      landColor: { value: appearance.landColor },
      landSecondaryColor: { value: appearance.landSecondaryColor },
      cloudColor: { value: appearance.cloudColor },
      atmosphereColor: { value: appearance.atmosphereColor },
      poleColor: { value: appearance.poleColor },
      equatorColor: { value: appearance.equatorColor },
      terrainScale: { value: appearance.terrainScale },
      terrainContrast: { value: appearance.terrainContrast },
      waterCoverage: { value: appearance.waterCoverage },
      waterGloss: { value: appearance.waterGloss },
      waterVisible: { value: appearance.waterVisible ? 1 : 0 },
      landCoverage: { value: appearance.landCoverage },
      cloudCoverage: { value: appearance.cloudCoverage },
      cloudOpacity: { value: appearance.cloudOpacity },
      cloudSpeed: { value: appearance.cloudSpeed },
      cloudVisible: { value: appearance.cloudVisible ? 1 : 0 },
      atmosphereIntensity: { value: appearance.atmosphereIntensity },
      atmosphereRimPower: { value: appearance.atmosphereRimPower },
      poleSize: { value: appearance.poleSize },
      poleVisible: { value: appearance.poleVisible ? 1 : 0 },
      equatorWidth: { value: appearance.equatorWidth },
      equatorIntensity: { value: appearance.equatorIntensity },
      equatorVisible: { value: appearance.equatorVisible ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      uniform vec3 lightDirection;
      uniform float time;
      uniform vec3 dayColorA;
      uniform vec3 dayColorB;
      uniform vec3 nightColor;
      uniform vec3 rimColor;
      uniform vec3 detailColorA;
      uniform vec3 detailColorB;
      uniform vec3 emissionColor;
      uniform float emissionStrength;
      uniform vec3 waterColor;
      uniform vec3 landColor;
      uniform vec3 landSecondaryColor;
      uniform vec3 cloudColor;
      uniform vec3 atmosphereColor;
      uniform vec3 poleColor;
      uniform vec3 equatorColor;
      uniform float terrainScale;
      uniform float terrainContrast;
      uniform float waterCoverage;
      uniform float waterGloss;
      uniform float waterVisible;
      uniform float landCoverage;
      uniform float cloudCoverage;
      uniform float cloudOpacity;
      uniform float cloudSpeed;
      uniform float cloudVisible;
      uniform float atmosphereIntensity;
      uniform float atmosphereRimPower;
      uniform float poleSize;
      uniform float poleVisible;
      uniform float equatorWidth;
      uniform float equatorIntensity;
      uniform float equatorVisible;

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 point) {
        vec2 i = floor(point);
        vec2 f = fract(point);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 5; i += 1) {
          value += noise(point) * amplitude;
          point = point * 2.03 + vec2(17.0, 9.0);
          amplitude *= 0.52;
        }

        return value;
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(lightDirection);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float diffuse = max(dot(normal, lightDir), 0.0);
        float wrappedLight = smoothstep(-0.18, 0.92, dot(normal, lightDir));
        float ambientFloor = 0.18;
        float litMix = ambientFloor + wrappedLight * (1.0 - ambientFloor);
        vec2 terrainUv = vec2(vUv.x * terrainScale, vUv.y * terrainScale * 1.24);
        float continentNoise = fbm(terrainUv + vec2(time * 0.003, 0.0));
        float detailNoise = fbm(vUv * (terrainScale * 2.7) + vec2(0.0, time * 0.002));
        float cloudNoise = fbm(vUv * (terrainScale * 1.45) + vec2(time * cloudSpeed * 0.08, time * cloudSpeed * 0.03));
        float bandNoise = sin(vUv.y * 18.0 + time * 0.3) * 0.5 + 0.5;
        float craterMask = smoothstep(0.62, 0.88, noise(vUv * 28.0));
        float waterMask = waterVisible * (1.0 - smoothstep(waterCoverage - 0.15, waterCoverage + terrainContrast * 0.25, continentNoise));
        float landMask = smoothstep(landCoverage - terrainContrast * 0.22, landCoverage + 0.08, continentNoise + detailNoise * 0.18);
        float poleMask = poleVisible * max(
          smoothstep(1.0 - poleSize * 1.35, 1.0 - poleSize * 0.22, abs(vUv.y - 0.5) * 2.0),
          0.0
        );
        float equatorMask = equatorVisible * (1.0 - smoothstep(equatorWidth, equatorWidth + 0.12, abs(vUv.y - 0.5)));
        float cloudMask = cloudVisible * smoothstep(cloudCoverage - 0.22, cloudCoverage + 0.12, cloudNoise) * cloudOpacity;
        vec3 oceanColor = mix(dayColorA, waterColor, 0.74);
        vec3 landBase = mix(landColor, landSecondaryColor, detailNoise);
        vec3 baseDay = mix(oceanColor, landBase, max(landMask, 1.0 - waterMask));
        vec3 detailColor = mix(detailColorA, detailColorB, detailNoise);
        vec3 dayColor = mix(baseDay, detailColor, 0.24 + terrainContrast * 0.26);
        dayColor = mix(dayColor, landSecondaryColor, bandNoise * equatorIntensity * 0.1);
        dayColor = mix(dayColor, detailColorB, craterMask * 0.18);
        dayColor = mix(dayColor, poleColor, poleMask * 0.78);
        dayColor = mix(dayColor, equatorColor, equatorMask * equatorIntensity * 0.46);
        dayColor = mix(dayColor, cloudColor, cloudMask * 0.68);
        vec3 litColor = mix(nightColor, dayColor, litMix);
        float silhouette = pow(1.0 - max(dot(normal, viewDir), 0.0), atmosphereRimPower);
        float terminator = pow(1.0 - wrappedLight, 1.8) * diffuse;
        float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 18.0) * waterMask * waterGloss;
        vec3 emissionGlow = emissionColor * emissionStrength * (0.45 + bandNoise * 0.55) * (0.35 + diffuse * 0.65);
        vec3 finalColor = litColor + atmosphereColor * silhouette * atmosphereIntensity * 0.34 + rimColor * terminator * 0.08 + emissionGlow + waterColor * specular * 0.34;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
};

export const createPlanetRing = (friend: FriendPlanet, planetRadius: number) => {
  const ring = friend.planet?.ring;

  if (!ring?.is_show) {
    return null;
  }

  const sourceRadius = friend.planet?.radius;
  const radiusRatio =
    typeof sourceRadius === 'number' && sourceRadius > 0
      ? 1 / sourceRadius
      : 1 / Math.max(planetRadius, 1);
  const innerScale = clamp((ring.inner_radius ?? 0) * radiusRatio || 1.28, 1.1, 2.8);
  const outerScale = clamp((ring.outer_radius ?? 0) * radiusRatio || 1.62, innerScale + 0.08, 3.4);
  const ringColor = getPlanetColor(ring.color, '#d7d1c4');
  const innerRadius = planetRadius * innerScale;
  const outerRadius = planetRadius * outerScale;
  const ringWidth = outerRadius - innerRadius;
  const particleCount = Math.round(
    clamp(2400 + ringWidth * 7600 + planetRadius * 1200, 3200, 18000),
  );
  const positions = new Float32Array(particleCount * 3);
  const scales = new Float32Array(particleCount);
  const seeds = new Float32Array(particleCount);
  const albedos = new Float32Array(particleCount);
  const angularVelocities = new Float32Array(particleCount);
  const ringBands = [
    { center: 0.08, width: 0.05, weight: 1.05 },
    { center: 0.2, width: 0.045, weight: 0.92 },
    { center: 0.36, width: 0.055, weight: 1.18 },
    { center: 0.5, width: 0.038, weight: 0.78 },
    { center: 0.69, width: 0.052, weight: 0.88 },
    { center: 0.84, width: 0.04, weight: 0.62 },
  ] as const;
  const totalBandWeight = ringBands.reduce((sum, band) => sum + band.weight, 0);

  const pickRingBand = () => {
    let threshold = Math.random() * totalBandWeight;

    for (const band of ringBands) {
      threshold -= band.weight;
      if (threshold <= 0) {
        return band;
      }
    }

    return ringBands[ringBands.length - 1];
  };

  for (let index = 0; index < particleCount; index += 1) {
    const band = pickRingBand();
    const jitter = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const radiusMix = clamp(band.center + jitter * band.width, 0.01, 0.99);
    const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, radiusMix);
    const angle = Math.random() * Math.PI * 2;
    const thicknessScale = THREE.MathUtils.lerp(0.018, 0.036, Math.max(0.0, 0.65 - radiusMix));
    const thickness = (Math.random() - 0.5) * planetRadius * thicknessScale;

    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = thickness;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
    scales[index] = THREE.MathUtils.lerp(0.42, 1.08, Math.pow(Math.random(), 0.82));
    seeds[index] = Math.random();
    albedos[index] = THREE.MathUtils.lerp(0.72, 1.02, band.weight / 1.18);
    angularVelocities[index] = THREE.MathUtils.lerp(0.68, 0.16, Math.pow(radiusMix, 0.72));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('albedo', new THREE.BufferAttribute(albedos, 1));
  geometry.setAttribute('angularVelocity', new THREE.BufferAttribute(angularVelocities, 1));

  const baseOpacity = clamp(0.28 + ringWidth * 0.045, 0.24, 0.38);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      time: { value: 0 },
      ringColor: { value: ringColor },
      innerRadius: { value: innerRadius },
      outerRadius: { value: outerRadius },
      opacity: { value: baseOpacity },
      pointScale: { value: planetRadius * 24 },
      brightness: { value: 1 },
    },
    vertexShader: `
      attribute float scale;
      attribute float seed;
      attribute float albedo;
      attribute float angularVelocity;

      uniform float time;
      uniform float innerRadius;
      uniform float outerRadius;
      uniform float pointScale;
      uniform float brightness;

      varying float vRadiusMix;
      varying float vSeed;
      varying float vAlbedo;
      varying float vBrightness;

      void main() {
        float radius = length(position.xz);
        float normalizedRadius = clamp((radius - innerRadius) / max(outerRadius - innerRadius, 0.0001), 0.0, 1.0);
        float banding = sin(normalizedRadius * 42.0 + seed * 18.0 + time * 0.06) * 0.5 + 0.5;
        float orbitAngle = atan(position.z, position.x) + time * angularVelocity + seed * 0.08;
        vec3 displacedPosition = vec3(
          cos(orbitAngle) * radius,
          position.y,
          sin(orbitAngle) * radius
        );
        displacedPosition.y += sin(time * 0.28 + seed * 31.4) * 0.0025;

        vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
        float distanceScale = clamp(pointScale / max(-mvPosition.z, 0.1), 0.0, 16.0);
        gl_PointSize = max(0.9, scale * distanceScale * (0.82 + banding * 0.18));
        gl_Position = projectionMatrix * mvPosition;

        vRadiusMix = normalizedRadius;
        vSeed = seed;
        vAlbedo = albedo;
        vBrightness = brightness;
      }
    `,
    fragmentShader: `
      uniform vec3 ringColor;
      uniform float opacity;
      uniform float time;

      varying float vRadiusMix;
      varying float vSeed;
      varying float vAlbedo;
      varying float vBrightness;

      float bandShape(float value, float center, float width) {
        return 1.0 - smoothstep(width, width * 1.85, abs(value - center));
      }

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float pointDistance = length(centered);
        float particleMask = 1.0 - smoothstep(0.2, 0.5, pointDistance);
        if (particleMask <= 0.01) {
          discard;
        }

        float edgeFade = smoothstep(0.02, 0.12, vRadiusMix) * (1.0 - smoothstep(0.88, 0.98, vRadiusMix));
        float broadBands = 0.0;
        broadBands += bandShape(vRadiusMix, 0.08, 0.055) * 0.94;
        broadBands += bandShape(vRadiusMix, 0.2, 0.048) * 0.78;
        broadBands += bandShape(vRadiusMix, 0.36, 0.06) * 1.0;
        broadBands += bandShape(vRadiusMix, 0.5, 0.04) * 0.62;
        broadBands += bandShape(vRadiusMix, 0.69, 0.055) * 0.76;
        broadBands += bandShape(vRadiusMix, 0.84, 0.042) * 0.52;
        broadBands = clamp(broadBands, 0.0, 1.0);

        float gapMask = 1.0;
        gapMask *= 1.0 - bandShape(vRadiusMix, 0.28, 0.028) * 0.42;
        gapMask *= 1.0 - bandShape(vRadiusMix, 0.61, 0.022) * 0.78;
        gapMask *= 1.0 - bandShape(vRadiusMix, 0.77, 0.018) * 0.5;

        float microStrata = 0.88 + 0.12 * sin(vRadiusMix * 180.0 + vSeed * 9.0);
        float sparkle = 0.94 + 0.06 * sin(time * 0.85 + vSeed * 51.0 + pointDistance * 10.0);
        float density = mix(0.08, 1.0, broadBands) * gapMask * edgeFade * microStrata;
        vec3 color = mix(ringColor * 0.78, vec3(0.98, 0.99, 1.0), 0.08 + broadBands * 0.1 + vAlbedo * 0.08);
        float alpha = opacity * particleMask * density * sparkle * vAlbedo * vBrightness;

        if (alpha <= 0.01) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.rotation.z = Math.PI * 0.18;
  points.renderOrder = 3;
  points.userData.baseOpacity = baseOpacity;
  points.userData.baseBrightness = 1;

  return points;
};

export type BuildPlanetEntryParams = {
  friend: FriendPlanet;
  index: number;
  hash: number;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  axialTilt: number;
  planetGroup: THREE.Group;
  orbitGroup: THREE.Group;
  glowTextures: Map<FriendPlanetType, THREE.Texture>;
};

export const buildPlanetEntry = ({
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
}: BuildPlanetEntryParams): PlanetEntry => {
  const inclination = ((hash % 9) - 4) * 0.015;
  const initialAngle = THREE.MathUtils.lerp(Math.PI * 0.28, Math.PI * 0.56, (hash % 101) / 100);
  const hueShift = ((hash % 19) - 9) * 0.01;

  const pivot = new THREE.Group();
  pivot.rotation.z = inclination;
  planetGroup.add(pivot);

  const orbitPivot = new THREE.Group();
  orbitPivot.rotation.z = inclination;
  orbitGroup.add(orbitPivot);

  const anchor = new THREE.Group();
  pivot.add(anchor);

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = axialTilt;
  anchor.add(tiltGroup);

  const planetMaterial = createPlanetMaterial(friend);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 40, 40), planetMaterial);
  const shellAppearance = getPlanetShellAppearance(friend, friend.type);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: shellAppearance.color,
    transparent: true,
    opacity: shellAppearance.shellOpacity,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(size * 1.04, 32, 32), shellMaterial);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getPlanetGlowTexture(glowTextures, friend.type),
      color: shellAppearance.color.clone().lerp(new THREE.Color('#ffffff'), 0.3),
      transparent: true,
      opacity: shellAppearance.glowOpacity,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.setScalar(size * 4.6);
  const ring = createPlanetRing(friend, size);
  const initialPosition = new THREE.Vector3(
    Math.cos(initialAngle) * orbitRadius,
    0,
    Math.sin(initialAngle) * orbitRadius,
  );
  planet.userData.friendPlanet = friend;
  planet.userData.tidalLocked = false;
  anchor.position.copy(initialPosition);
  planet.position.set(0, 0, 0);
  tiltGroup.add(planet);
  shell.position.set(0, 0, 0);
  anchor.add(shell);
  glow.position.set(0, 0, 0);
  anchor.add(glow);
  if (ring) {
    ring.position.set(0, 0, 0);
    tiltGroup.add(ring);
  }

  const orbitOccluder = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.02, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  orbitOccluder.material.colorWrite = false;
  orbitOccluder.renderOrder = 1;
  orbitOccluder.frustumCulled = false;
  orbitPivot.add(orbitOccluder);

  return {
    data: friend,
    pivot,
    anchor,
    tiltGroup,
    mesh: planet,
    shell,
    glow,
    ring,
    orbitOccluder,
    shellBaseColor: shellAppearance.color,
    shellBaseOpacity: shellAppearance.shellOpacity,
    glowBaseOpacity: shellAppearance.glowOpacity,
    radius: size,
    orbitRadius,
    orbitSpeed,
    rotationSpeed,
    axialTilt,
    hueShift,
    phase: initialAngle + index * 0.18,
  };
};
