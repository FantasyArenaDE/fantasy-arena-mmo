interface Point {
  x: number;
  y: number;
}

interface Segment {
  from: Point;
  to: Point;
}

const HUB = { x: 0.52, y: 0.48 };
const ANCHORS: readonly Point[] = [
  { x: 0.98, y: 0.77 },
  { x: 0.82, y: 0.91 },
  { x: 0.54, y: 0.98 },
  { x: 0.29, y: 0.87 },
  { x: 0.02, y: 0.68 },
  { x: 0.13, y: 0.25 },
  { x: 0.39, y: 0.04 },
  { x: 0.63, y: 0.03 },
  { x: 0.86, y: 0.2 },
];

export function fenceDewWebVariant(id: string): 0 | 1 | undefined {
  if (id === 'eastbrook_fence_smithy_west') return 0;
  if (id === 'eastbrook_fence_smithy_east') return 1;
}

function between(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function fenceDewMorning(phase: number): number {
  return smooth(0.24, 0.275, phase) * (1 - smooth(0.335, 0.4, phase));
}

export function fenceDewPattern(): {
  silk: Segment[];
  strand: Segment;
  drops: Point[];
} {
  // The orb is compact; longer support threads stretch to the fence posts.
  const rim = ANCHORS.map(({ x, y }) => ({ x: HUB.x + (x - HUB.x) * 0.46, y }));
  const silk = rim.map((to) => ({ from: HUB, to }));
  for (let i = 0; i < rim.length; i++) {
    silk.push({ from: rim[i], to: ANCHORS[i] });
    silk.push({ from: rim[i], to: rim[(i + 1) % rim.length] });
  }
  const drops: Point[] = [];
  for (let ring = 0; ring < 5; ring++) {
    const points = rim.map((anchor, i) =>
      between(HUB, anchor, 0.19 + ring * 0.12 + Math.sin(i * 2.4 + ring * 0.7) * 0.032),
    );
    for (let i = 0; i < points.length; i++) {
      const from = points[i];
      const to = points[(i + 1) % points.length];
      silk.push({ from, to });
      if ((i * 3 + ring * 2) % 7 < 3) drops.push(between(from, to, 0.26 + ((i + ring) % 4) * 0.13));
    }
  }
  return { silk, strand: { from: rim[4], to: HUB }, drops };
}
