import * as THREE from "three";

// Inflate the official 2D silhouette into a closed pebble: equator matches
// the mark, meridians are elliptical, then a little noise for organic sides.

type PebbleOptions = {
  points: THREE.Vector2[];
  latSegments?: number;
  lonSegments?: number;
  depthRatio?: number;
  noise?: number;
};

export type PebbleMesh = {
  geometry: THREE.BufferGeometry;
  lut: Float32Array;
  depth: number;
};

export function createPebbleGeometry({
  points,
  latSegments = 72,
  lonSegments = 96,
  depthRatio = 0.92,
  noise = 0.026,
}: PebbleOptions): PebbleMesh {
  const lut = buildRadiusLut(points, 720);
  const avgRadius = average(lut);
  const depth = avgRadius * depthRatio;

  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= latSegments; i += 1) {
    const phi = (i / latSegments) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let j = 0; j <= lonSegments; j += 1) {
      const theta = (j / lonSegments) * Math.PI * 2 - Math.PI;
      const radius = sampleLut(lut, theta);
      let x = radius * sinPhi * Math.cos(theta);
      let y = radius * sinPhi * Math.sin(theta);
      let z = depth * cosPhi;

      if (noise > 0) {
        const n = fbm(x * 1.7, y * 1.7, z * 1.7);
        const bulge = 1 + noise * n * (0.35 + 0.65 * sinPhi);
        x *= bulge;
        y *= bulge;
        z *= bulge;
      }

      positions.push(x, y, z);
      uvs.push(j / lonSegments, 1 - i / latSegments);
    }
  }

  const indices: number[] = [];
  const cols = lonSegments + 1;
  for (let i = 0; i < latSegments; i += 1) {
    for (let j = 0; j < lonSegments; j += 1) {
      const a = i * cols + j;
      const b = a + cols;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, lut, depth };
}

export function surfacePoint(
  lut: Float32Array,
  depth: number,
  x: number,
  y: number,
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  const theta = Math.atan2(y, x);
  const radius = sampleLut(lut, theta);
  const d = Math.hypot(x, y);
  const sinPhi = Math.min(0.999, d / Math.max(radius, 1e-6));
  const cosPhi = Math.sqrt(Math.max(0, 1 - sinPhi * sinPhi));
  const position = new THREE.Vector3(x, y, depth * cosPhi);
  const normal = new THREE.Vector3(
    x / (radius * radius),
    y / (radius * radius),
    position.z / (depth * depth),
  ).normalize();
  return { position, normal };
}

export function buildRadiusLut(points: THREE.Vector2[], bins: number): Float32Array {
  const lut = new Float32Array(bins);
  const filled = new Uint8Array(bins);

  for (const point of points) {
    const theta = Math.atan2(point.y, point.x);
    const bin = wrapIndex(
      Math.round(((theta + Math.PI) / (Math.PI * 2)) * bins),
      bins,
    );
    const radius = Math.hypot(point.x, point.y);
    const current = lut[bin] ?? 0;
    if (radius > current) {
      lut[bin] = radius;
      filled[bin] = 1;
    }
  }

  let last = 0;
  for (let i = 0; i < bins * 2; i += 1) {
    const index = i % bins;
    if (filled[index]) {
      last = lut[index] ?? last;
    } else {
      lut[index] = last;
    }
  }

  const smoothed = new Float32Array(bins);
  const span = 6;
  for (let i = 0; i < bins; i += 1) {
    let sum = 0;
    let weight = 0;
    for (let k = -span; k <= span; k += 1) {
      const w = 1 - Math.abs(k) / (span + 1);
      sum += (lut[wrapIndex(i + k, bins)] ?? 0) * w;
      weight += w;
    }
    smoothed[i] = sum / weight;
  }
  return smoothed;
}

export function sampleLut(lut: Float32Array, theta: number): number {
  const bins = lut.length;
  let t = (theta + Math.PI) / (Math.PI * 2);
  t -= Math.floor(t);
  const x = t * bins;
  const i0 = wrapIndex(Math.floor(x), bins);
  const i1 = wrapIndex(i0 + 1, bins);
  const f = x - Math.floor(x);
  return (lut[i0] ?? 0) * (1 - f) + (lut[i1] ?? 0) * f;
}

function wrapIndex(index: number, bins: number): number {
  return ((index % bins) + bins) % bins;
}

function average(values: Float32Array): number {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 * (1 - u) + n100 * u;
  const nx10 = n010 * (1 - u) + n110 * u;
  const nx01 = n001 * (1 - u) + n101 * u;
  const nx11 = n011 * (1 - u) + n111 * u;
  const nxy0 = nx00 * (1 - v) + nx10 * v;
  const nxy1 = nx01 * (1 - v) + nx11 * v;
  return nxy0 * (1 - w) + nxy1 * w;
}

function fbm(x: number, y: number, z: number): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += amp * (valueNoise(x * freq, y * freq, z * freq) * 2 - 1);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}
