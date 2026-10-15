import type { ComponentCategory } from '@content/types';

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  'clients-edge': 'Clients & edge',
  compute: 'Compute',
  data: 'Data',
  messaging: 'Messaging',
  ml: 'ML',
  llm: 'LLM',
};

const n = (v: number) => Number(v.toFixed(1));

/**
 * Closed outline for a node of the given category, drawn at the origin.
 * Each category has its own silhouette so meaning never depends on color.
 */
export function shapePath(category: ComponentCategory, w: number, h: number): string {
  switch (category) {
    case 'clients-edge': {
      const r = h / 2;
      return `M ${n(r)} 0 H ${n(w - r)} A ${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(h)} H ${n(r)} A ${n(r)} ${n(r)} 0 0 1 ${n(r)} 0 Z`;
    }
    case 'compute': {
      const r = 8;
      return `M ${r} 0 H ${n(w - r)} Q ${n(w)} 0 ${n(w)} ${r} V ${n(h - r)} Q ${n(w)} ${n(h)} ${n(w - r)} ${n(h)} H ${r} Q 0 ${n(h)} 0 ${n(h - r)} V ${r} Q 0 0 ${r} 0 Z`;
    }
    case 'data': {
      const ry = 8;
      return `M 0 ${ry} A ${n(w / 2)} ${ry} 0 0 1 ${n(w)} ${ry} V ${n(h - ry)} A ${n(w / 2)} ${ry} 0 0 1 0 ${n(h - ry)} Z`;
    }
    case 'messaging':
      return `M 0 0 H ${n(w - 16)} L ${n(w)} ${n(h / 2)} L ${n(w - 16)} ${n(h)} H 0 L 12 ${n(h / 2)} Z`;
    case 'ml':
      return `M 0 0 H ${n(w - 18)} L ${n(w)} 18 V ${n(h)} H 0 Z`;
    case 'llm':
      return `M 16 0 H ${n(w - 16)} L ${n(w)} ${n(h / 2)} L ${n(w - 16)} ${n(h)} H 16 L 0 ${n(h / 2)} Z`;
  }
}

/** Extra detail lines (e.g. the visible rim of a cylinder); null when none. */
export function shapeDetail(category: ComponentCategory, w: number): string | null {
  if (category === 'data') return `M 0 8 A ${n(w / 2)} 8 0 0 0 ${n(w)} 8`;
  return null;
}
