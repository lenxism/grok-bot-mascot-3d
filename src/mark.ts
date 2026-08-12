import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

export type EyeMark = {
  centroid: THREE.Vector2;
  axis: THREE.Vector2;
  length: number;
  width: number;
};

export type ParsedMark = {
  headPoints: THREE.Vector2[];
  eyes: [EyeMark, EyeMark];
};

type PathSample = {
  points: THREE.Vector2[];
  area: number;
  centroid: THREE.Vector2;
};

const TARGET_WIDTH = 2.32;

export function parseMark(svgText: string): ParsedMark {
  const data = new SVGLoader().parse(svgText);
  const samples: PathSample[] = [];

  for (const path of data.paths) {
    for (const subPath of path.subPaths) {
      const raw = subPath.getPoints(96);
      if (raw.length < 8) {
        continue;
      }
      const points = raw.map((point) => new THREE.Vector2(point.x, -point.y));
      const area = Math.abs(shoelace(points));
      if (area < 1) {
        continue;
      }
      samples.push({
        points,
        area,
        centroid: polygonCentroid(points),
      });
    }
  }

  const unique = dedupePaths(samples);
  unique.sort((a, b) => b.area - a.area);

  const head = unique[0];
  const eyeA = unique[1];
  const eyeB = unique[2];
  if (!head || !eyeA || !eyeB) {
    throw new Error("Official mark SVG did not yield a head and two eyes.");
  }

  const headBox = new THREE.Box2().setFromPoints(head.points);
  const size = new THREE.Vector2();
  headBox.getSize(size);
  const scale = TARGET_WIDTH / size.x;
  const origin = head.centroid.clone();

  const headPoints = head.points.map((point) =>
    point.clone().sub(origin).multiplyScalar(scale),
  );

  const eyes = [eyeA, eyeB]
    .map((eye) => toEyeMark(eye, origin, scale))
    .sort((a, b) => a.centroid.x - b.centroid.x);

  const left = eyes[0];
  const right = eyes[1];
  if (!left || !right) {
    throw new Error("Could not separate left and right eyes.");
  }

  return { headPoints, eyes: [left, right] };
}

function toEyeMark(eye: PathSample, origin: THREE.Vector2, scale: number): EyeMark {
  const points = eye.points.map((point) =>
    point.clone().sub(origin).multiplyScalar(scale),
  );
  const centroid = polygonCentroid(points);
  const axis = principalAxis(points, centroid);
  const extents = axisExtents(points, centroid, axis);
  return {
    centroid,
    axis,
    length: extents.length,
    width: extents.width,
  };
}

function dedupePaths(samples: PathSample[]): PathSample[] {
  const kept: PathSample[] = [];
  for (const sample of samples) {
    const duplicate = kept.some(
      (other) =>
        Math.abs(other.area - sample.area) / other.area < 0.02 &&
        other.centroid.distanceTo(sample.centroid) < 2,
    );
    if (!duplicate) {
      kept.push(sample);
    }
  }
  return kept;
}

function shoelace(points: THREE.Vector2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) {
      continue;
    }
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function polygonCentroid(points: THREE.Vector2[]): THREE.Vector2 {
  let x = 0;
  let y = 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) {
      continue;
    }
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-8) {
    const avg = new THREE.Vector2();
    for (const point of points) {
      avg.add(point);
    }
    return avg.multiplyScalar(1 / points.length);
  }
  return new THREE.Vector2(x / (6 * area), y / (6 * area));
}

function principalAxis(points: THREE.Vector2[], centroid: THREE.Vector2): THREE.Vector2 {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const trace = xx + yy;
  const det = xx * yy - xy * xy;
  const disc = Math.max(0, (trace / 2) ** 2 - det);
  const lambda = trace / 2 + Math.sqrt(disc);
  let vx = xy;
  let vy = lambda - xx;
  if (Math.hypot(vx, vy) < 1e-8) {
    vx = 1;
    vy = 0;
  }
  const axis = new THREE.Vector2(vx, vy).normalize();
  if (axis.x < 0) {
    axis.negate();
  }
  return axis;
}

function axisExtents(
  points: THREE.Vector2[],
  centroid: THREE.Vector2,
  axis: THREE.Vector2,
): { length: number; width: number } {
  const side = new THREE.Vector2(-axis.y, axis.x);
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  let minSide = Infinity;
  let maxSide = -Infinity;
  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const along = dx * axis.x + dy * axis.y;
    const across = dx * side.x + dy * side.y;
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
    minSide = Math.min(minSide, across);
    maxSide = Math.max(maxSide, across);
  }
  return {
    length: maxAlong - minAlong,
    width: maxSide - minSide,
  };
}
