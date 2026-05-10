import RBush from 'rbush';
import { Point, VectorLine, BBox } from '@/types/map.types';

let rBushTree: RBush<VectorLine> | null = null;

export type WorkerMessage = 
  | { type: 'LOAD_VECTORS'; payload: VectorLine[] }
  | { type: 'FIND_SNAP'; payload: { point: Point; threshold: number; id: string } };

export type WorkerResponse = 
  | { type: 'VECTORS_LOADED' }
  | { type: 'SNAP_RESULT'; payload: { id: string; snappedPoint: Point | null } };

// Utility to calculate point-to-line segment distance and projection
function sqr(x: number) { return x * x; }
function dist2(v: Point, w: Point) { return sqr(v.pctX - w.pctX) + sqr(v.pctY - w.pctY); }

function distToSegment(p: Point, v: Point, w: Point) { 
  const l2 = dist2(v, w);
  if (l2 === 0) return Math.sqrt(dist2(p, v));
  let t = ((p.pctX - v.pctX) * (w.pctX - v.pctX) + (p.pctY - v.pctY) * (w.pctY - v.pctY)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(dist2(p, { pctX: v.pctX + t * (w.pctX - v.pctX), pctY: v.pctY + t * (w.pctY - v.pctY) }));
}

function projectPointOntoSegment(p: Point, v: Point, w: Point): Point {
  const l2 = dist2(v, w);
  if (l2 === 0) return v;
  let t = ((p.pctX - v.pctX) * (w.pctX - v.pctX) + (p.pctY - v.pctY) * (w.pctY - v.pctY)) / l2;
  t = Math.max(0, Math.min(1, t));
  return { pctX: v.pctX + t * (w.pctX - v.pctX), pctY: v.pctY + t * (w.pctY - v.pctY) };
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  if (msg.type === 'LOAD_VECTORS') {
    rBushTree = new RBush<VectorLine>();
    rBushTree.load(msg.payload);
    self.postMessage({ type: 'VECTORS_LOADED' });
  } 
  else if (msg.type === 'FIND_SNAP') {
    if (!rBushTree) {
      self.postMessage({ type: 'SNAP_RESULT', payload: { id: msg.payload.id, snappedPoint: null } });
      return;
    }
    
    const { point, threshold, id } = msg.payload;
    
    const bbox: BBox = {
      minX: point.pctX - threshold,
      minY: point.pctY - threshold,
      maxX: point.pctX + threshold,
      maxY: point.pctY + threshold,
    };
    
    const candidates = rBushTree.search(bbox);
    
    let closestDist = Infinity;
    let closestPoint: Point | null = null;
    
    for (const cand of candidates) {
      const { start, end } = cand.lineData;
      const d = distToSegment(point, start, end);
      if (d < threshold && d < closestDist) {
        closestDist = d;
        closestPoint = projectPointOntoSegment(point, start, end);
      }
    }
    
    self.postMessage({ type: 'SNAP_RESULT', payload: { id, snappedPoint: closestPoint } });
  }
};
