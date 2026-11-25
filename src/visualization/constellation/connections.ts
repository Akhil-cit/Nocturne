export interface Point2D {
  x: number;
  y: number;
}

interface CandidateEdge {
  a: number;
  b: number;
  dist: number;
}

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (cy - ay) * (bx - ax) - (by - ay) * (cx - ax);
}

function segmentsIntersect(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): boolean {
  const d1 = ccw(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
  const d2 = ccw(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
  const d3 = ccw(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  const d4 = ccw(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Calculates natural constellation connections using nearest-neighbor selection
 * while filtering out overly long edges and avoiding crossing lines.
 */
export function calculateConnections(
  positions: Point2D[],
  maxDistance = 340,
  minNeighbors = 2,
  maxNeighbors = 3
): [number, number][] {
  const count = positions.length;
  if (count < 2) return [];

  const candidateMap = new Map<string, CandidateEdge>();
  const neighborLists: { index: number; dist: number }[][] = Array.from(
    { length: count },
    () => []
  );

  // Gather all distances
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.hypot(dx, dy);
      if (dist <= maxDistance) {
        neighborLists[i].push({ index: j, dist });
        neighborLists[j].push({ index: i, dist });
      }
    }
  }

  // Pick nearest neighbors for each node
  for (let i = 0; i < count; i++) {
    const list = neighborLists[i];
    list.sort((a, b) => a.dist - b.dist);

    const limit = Math.min(list.length, maxNeighbors);
    for (let k = 0; k < limit; k++) {
      const j = list[k].index;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = `${a}:${b}`;
      if (!candidateMap.has(key)) {
        candidateMap.set(key, { a, b, dist: list[k].dist });
      }
    }
  }

  // Sort shortest edges first so short natural links take priority over long ones
  const candidates = Array.from(candidateMap.values()).sort((e1, e2) => e1.dist - e2.dist);

  const accepted: [number, number][] = [];
  const degree = new Int32Array(count);

  for (const edge of candidates) {
    // Respect max degree unless a node still needs its minimum neighbors
    if (
      degree[edge.a] >= maxNeighbors &&
      degree[edge.b] >= maxNeighbors
    ) {
      continue;
    }

    // Check against accepted edges for segment crossings (ignoring shared endpoints)
    let crosses = false;
    const p1 = positions[edge.a];
    const p2 = positions[edge.b];

    for (let k = 0; k < accepted.length; k++) {
      const [ea, eb] = accepted[k];
      if (ea === edge.a || ea === edge.b || eb === edge.a || eb === edge.b) {
        continue;
      }
      if (segmentsIntersect(p1, p2, positions[ea], positions[eb])) {
        crosses = true;
        break;
      }
    }

    if (!crosses) {
      accepted.push([edge.a, edge.b]);
      degree[edge.a]++;
      degree[edge.b]++;
    }
  }

  // Ensure no isolated star if there is a reasonable nearest neighbor
  for (let i = 0; i < count; i++) {
    if (degree[i] < Math.min(minNeighbors, count - 1) && degree[i] === 0) {
      let bestIdx = -1;
      let bestDist = maxDistance * 1.45;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        const a = Math.min(i, bestIdx);
        const b = Math.max(i, bestIdx);
        accepted.push([a, b]);
        degree[a]++;
        degree[b]++;
      }
    }
  }

  return accepted;
}
