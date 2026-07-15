export type InspectorZoneId = "alpha" | "residue";

export const inspectorZones: InspectorZoneId[] = ["alpha", "residue"];

export interface InspectorZoneLayout {
  order: InspectorZoneId[];
  collapsed: Record<InspectorZoneId, boolean>;
}

export const defaultInspectorZoneLayout: InspectorZoneLayout = {
  order: [...inspectorZones],
  collapsed: { alpha: false, residue: true },
};

export function normalizeInspectorZoneLayout(value: unknown): InspectorZoneLayout {
  if (!value || typeof value !== "object") return structuredClone(defaultInspectorZoneLayout);
  const candidate = value as Partial<InspectorZoneLayout>;
  const validOrder = Array.isArray(candidate.order)
    ? candidate.order.filter((id, index, values): id is InspectorZoneId => inspectorZones.includes(id as InspectorZoneId) && values.indexOf(id) === index)
    : [];
  const order = [...validOrder, ...inspectorZones.filter((id) => !validOrder.includes(id))];
  return {
    order,
    collapsed: {
      alpha: typeof candidate.collapsed?.alpha === "boolean" ? candidate.collapsed.alpha : defaultInspectorZoneLayout.collapsed.alpha,
      residue: typeof candidate.collapsed?.residue === "boolean" ? candidate.collapsed.residue : defaultInspectorZoneLayout.collapsed.residue,
    },
  };
}

export type DropPosition = "before" | "after";

export function placeInspectorZone(order: InspectorZoneId[], source: InspectorZoneId, target: InspectorZoneId, position: DropPosition) {
  if (source === target || !order.includes(source) || !order.includes(target)) return order;
  const next = order.filter((id) => id !== source);
  const targetIndex = next.indexOf(target);
  next.splice(position === "before" ? targetIndex : targetIndex + 1, 0, source);
  return next;
}
