import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import type { DiffRegion } from "@/lib/types";

const MIN_REGION_PIXELS = 36;
const REGION_PADDING = 2;
const MERGE_GAP = 8;
const MAX_REGIONS = 150;

interface RawRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixel_count: number;
}

export function generateDiff(
  designPngBuffer: Buffer,
  implementationPngBuffer: Buffer
): {
  diffBuffer: Buffer;
  regions: DiffRegion[];
  width: number;
  height: number;
  mismatch_pixels: number;
} {
  const design = PNG.sync.read(designPngBuffer);
  const implementation = PNG.sync.read(implementationPngBuffer);

  if (design.width !== implementation.width || design.height !== implementation.height) {
    throw new Error("Design and implementation images must share the same dimensions.");
  }

  const diff = new PNG({ width: design.width, height: design.height });

  const mismatchPixels = pixelmatch(
    design.data,
    implementation.data,
    diff.data,
    design.width,
    design.height,
    {
      threshold: 0.1,
      alpha: 0,
      diffMask: true,
      includeAA: true
    }
  );

  const rawRegions = detectConnectedRegions(diff.data, design.width, design.height)
    .filter((region) => region.pixel_count >= MIN_REGION_PIXELS)
    .map((region) => padRegion(region, design.width, design.height));

  const merged = mergeNearbyRegions(rawRegions);

  const regions: DiffRegion[] = merged.slice(0, MAX_REGIONS).map((region, index) => ({
    id: index + 1,
    x: region.x1,
    y: region.y1,
    width: region.x2 - region.x1 + 1,
    height: region.y2 - region.y1 + 1,
    pixel_count: region.pixel_count
  }));

  return {
    diffBuffer: PNG.sync.write(diff),
    regions,
    width: design.width,
    height: design.height,
    mismatch_pixels: mismatchPixels
  };
}

function detectConnectedRegions(data: Buffer, width: number, height: number): RawRegion[] {
  const visited = new Uint8Array(width * height);
  const regions: RawRegion[] = [];
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x;
      if (visited[offset] === 1 || !isDiffPixel(data, offset)) {
        continue;
      }

      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;
      visited[offset] = 1;

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let pixels = 0;

      while (head < tail) {
        const currentX = queueX[head];
        const currentY = queueY[head];
        head += 1;
        pixels += 1;

        if (currentX < minX) minX = currentX;
        if (currentY < minY) minY = currentY;
        if (currentX > maxX) maxX = currentX;
        if (currentY > maxY) maxY = currentY;

        const neighbors: [number, number][] = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1]
        ];

        for (const [nextX, nextY] of neighbors) {
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            continue;
          }

          const neighborOffset = nextY * width + nextX;
          if (visited[neighborOffset] === 1 || !isDiffPixel(data, neighborOffset)) {
            continue;
          }

          visited[neighborOffset] = 1;
          queueX[tail] = nextX;
          queueY[tail] = nextY;
          tail += 1;
        }
      }

      regions.push({ x1: minX, y1: minY, x2: maxX, y2: maxY, pixel_count: pixels });
    }
  }

  return regions;
}

function padRegion(region: RawRegion, width: number, height: number): RawRegion {
  return {
    ...region,
    x1: Math.max(0, region.x1 - REGION_PADDING),
    y1: Math.max(0, region.y1 - REGION_PADDING),
    x2: Math.min(width - 1, region.x2 + REGION_PADDING),
    y2: Math.min(height - 1, region.y2 + REGION_PADDING)
  };
}

function mergeNearbyRegions(regions: RawRegion[]): RawRegion[] {
  if (regions.length <= 1) {
    return regions;
  }

  const sorted = [...regions].sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  let changed = true;
  let current = sorted;

  while (changed) {
    changed = false;
    const next: RawRegion[] = [];

    for (const region of current) {
      let merged = false;

      for (let i = 0; i < next.length; i += 1) {
        if (!shouldMerge(next[i], region)) {
          continue;
        }

        next[i] = {
          x1: Math.min(next[i].x1, region.x1),
          y1: Math.min(next[i].y1, region.y1),
          x2: Math.max(next[i].x2, region.x2),
          y2: Math.max(next[i].y2, region.y2),
          pixel_count: next[i].pixel_count + region.pixel_count
        };
        merged = true;
        changed = true;
        break;
      }

      if (!merged) {
        next.push(region);
      }
    }

    current = next;
  }

  return current;
}

function shouldMerge(a: RawRegion, b: RawRegion): boolean {
  return !(
    a.x2 + MERGE_GAP < b.x1 ||
    b.x2 + MERGE_GAP < a.x1 ||
    a.y2 + MERGE_GAP < b.y1 ||
    b.y2 + MERGE_GAP < a.y1
  );
}

function isDiffPixel(data: Buffer, pixelOffset: number): boolean {
  const alpha = data[pixelOffset * 4 + 3];
  return alpha > 0;
}
