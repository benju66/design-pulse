/**
 * treemapLayout — Squarified treemap layout algorithm.
 *
 * Pure TypeScript, zero dependencies. Computes rectangle positions for a flat
 * list of weighted nodes within a bounding box. Optimises for square-ish
 * aspect ratios (Bruls, Huizing & van Wijk, 2000).
 *
 * iOS Safety (AGENTS.md A): no regex. All string/math operations only.
 */

export interface TreemapInputNode {
  id: string;
  label: string;
  value: number;
  /** Arbitrary metadata carried through to the output for tooltip/coloring */
  meta?: Record<string, unknown>;
}

export interface TreemapRect extends TreemapInputNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Worst aspect ratio of a row of items laid out along the short edge.
 * Lower is better (closer to 1 = more square).
 */
function worstAspectRatio(row: number[], shortEdge: number): number {
  if (row.length === 0 || shortEdge <= 0) return Infinity;
  const rowSum = row.reduce((a, b) => a + b, 0);
  const rowMax = Math.max(...row);
  const rowMin = Math.min(...row);
  const s2 = shortEdge * shortEdge;
  return Math.max(
    (s2 * rowMax) / (rowSum * rowSum),
    (rowSum * rowSum) / (s2 * rowMin)
  );
}

/**
 * Computes a squarified treemap layout.
 *
 * @param nodes  — Input nodes with positive `value`. Zero/negative values are filtered out.
 * @param bounds — Bounding rectangle to fill.
 * @returns Array of nodes with computed {x, y, width, height}.
 */
export function computeTreemapLayout(
  nodes: TreemapInputNode[],
  bounds: Bounds
): TreemapRect[] {
  // Filter and sort descending by value (required by squarify algorithm)
  const sorted = nodes
    .filter(n => n.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length === 0) return [];

  const totalValue = sorted.reduce((s, n) => s + n.value, 0);
  const totalArea = bounds.width * bounds.height;

  // Scale values to areas proportional to the bounding box
  const areas = sorted.map(n => (n.value / totalValue) * totalArea);

  const rects: TreemapRect[] = [];
  let remaining = { ...bounds };
  let currentRow: number[] = [];
  let currentRowIndices: number[] = [];
  let i = 0;

  while (i < areas.length) {
    const shortEdge = Math.min(remaining.width, remaining.height);
    const area = areas[i];

    const testRow = [...currentRow, area];
    const testIndices = [...currentRowIndices, i];

    if (
      currentRow.length === 0 ||
      worstAspectRatio(testRow, shortEdge) <=
        worstAspectRatio(currentRow, shortEdge)
    ) {
      // Adding this item improves (or maintains) the aspect ratio — keep going
      currentRow = testRow;
      currentRowIndices = testIndices;
      i++;
    } else {
      // Adding this item makes it worse — lay out the current row and start fresh
      layoutRow(currentRow, currentRowIndices, remaining, sorted, rects);
      remaining = trimBounds(currentRow, remaining);
      currentRow = [];
      currentRowIndices = [];
      // Don't increment i — re-evaluate this item in the new remaining space
    }
  }

  // Lay out any remaining items
  if (currentRow.length > 0) {
    layoutRow(currentRow, currentRowIndices, remaining, sorted, rects);
  }

  return rects;
}

/** Lay out a row of items along the short edge of the remaining bounds. */
function layoutRow(
  row: number[],
  indices: number[],
  bounds: Bounds,
  nodes: TreemapInputNode[],
  out: TreemapRect[]
): void {
  const rowSum = row.reduce((a, b) => a + b, 0);
  const isHorizontal = bounds.width >= bounds.height;

  // The row occupies a strip along the short edge
  const stripSize = rowSum / (isHorizontal ? bounds.height : bounds.width);
  let offset = 0;

  for (let j = 0; j < row.length; j++) {
    const itemSize = row[j] / stripSize;
    const node = nodes[indices[j]];

    if (isHorizontal) {
      out.push({
        ...node,
        x: bounds.x,
        y: bounds.y + offset,
        width: stripSize,
        height: itemSize,
      });
    } else {
      out.push({
        ...node,
        x: bounds.x + offset,
        y: bounds.y,
        width: itemSize,
        height: stripSize,
      });
    }
    offset += itemSize;
  }
}

/** Shrink the bounds after laying out a row. */
function trimBounds(row: number[], bounds: Bounds): Bounds {
  const rowSum = row.reduce((a, b) => a + b, 0);
  const isHorizontal = bounds.width >= bounds.height;
  const stripSize = rowSum / (isHorizontal ? bounds.height : bounds.width);

  if (isHorizontal) {
    return {
      x: bounds.x + stripSize,
      y: bounds.y,
      width: bounds.width - stripSize,
      height: bounds.height,
    };
  }
  return {
    x: bounds.x,
    y: bounds.y + stripSize,
    width: bounds.width,
    height: bounds.height - stripSize,
  };
}
