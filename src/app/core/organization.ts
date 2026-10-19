import {
  DemoState, OrganizationUnit, Person, Position, PositionAppointment, WorkLocation,
} from "./models";

/**
 * Backwards-compatible, deterministic migration for v1 browser snapshots.
 * Never discard job, nomination, evaluation, plan, or person IDs.
 * Historical job/unit/manager fields stay as read-model compatibility projections.
 */
export function hydrateOrganization(state: DemoState): DemoState {
  const units: OrganizationUnit[] = Array.isArray(state.organizationUnits)
    ? state.organizationUnits : [];
  const locations: WorkLocation[] = Array.isArray(state.workLocations)
    ? state.workLocations : [];
  const positions = state.positions;
  const allUnitNames = [...new Set([
    ...state.jobs.map((j) => j.unit),
    ...state.people.map((p) => p.unit),
    ...positions.map((p) => p.unit),
  ].filter(Boolean))];
  if (!units.length) {
    state.organizationUnits = allUnitNames.map((name, i) => ({
      id: `unit-${i + 1}`, code: `UNIT-${i + 1}`,
      name, parentUnitId: null, isActive: true,
    }));
  }
  if (!locations.length) {
    state.workLocations = [{
      id: "location-main", code: "LOC-001", name: "ستاد مرکزی", isActive: true,
    }];
  }
  const resolveUnit = (label: string) =>
    state.organizationUnits.find((u) => u.name === label)?.id ??
    state.organizationUnits[0]?.id ?? "";
  const defaultLocation = state.workLocations[0]?.id ?? "";
  const existing = new Map<string, Position>();
  for (const position of positions) {
    position.code ??= `POST-${position.id}`;
    position.unitId ??= resolveUnit(position.unit);
    position.locationId ??= defaultLocation;
    position.parentPositionId ??= null;
    position.isActive ??= true;
    if (position.holderId && !existing.has(position.holderId)) {
      existing.set(position.holderId, position);
    }
  }
  // Older projects had only 15 succession positions, but >30 employed people.
  // Fill the missing links without changing existing position IDs or nominations.
  for (const p of state.people) {
    if (existing.has(p.id)) continue;
    const position: Position = {
      id: `staff-${p.id}`, code: `POST-${p.code}`,
      title: state.jobs.find((job) => job.id === p.jobId)?.title ?? "پست سازمانی",
      jobId: p.jobId, holderId: p.id, unit: p.unit,
      unitId: resolveUnit(p.unit), locationId: defaultLocation,
      parentPositionId: null, isActive: true,
      critical: false, reason: "", probability: 1, impact: 1, months: 6,
    };
    positions.push(position);
    existing.set(p.id, position);
  }
  // Avoid manufacturing a management cycle from legacy demo managerId values:
  // p11 and p21 pointed at each other in the original seed. Build a sensible
  // presentation chart from work units where a person is not their own superior.
  if (!Array.isArray(state.appointments)) {
    const leads = new Map<string, string>();
    for (const person of state.people) {
      const position = existing.get(person.id)!;
      if (!leads.has(person.unit) && position.id.startsWith("pos"))
        leads.set(person.unit, person.id);
    }
    const top = existing.get("p21") ? "p21" : state.people.at(-1)?.id;
    for (const person of state.people) {
      const position = existing.get(person.id)!;
      const leader = leads.get(person.unit);
      let proposed = leader && leader !== person.id ? leader
        : top && top !== person.id ? top : undefined;
      if (!proposed || proposed === person.id) {
        position.parentPositionId = null;
        continue;
      }
      const parent = existing.get(proposed);
      position.parentPositionId = parent?.id ?? null;
      if (wouldCycle(positions, position.id, position.parentPositionId))
        position.parentPositionId = null;
    }
    state.appointments = state.people.map((p) => ({
      id: `initial-appointment-${p.id}`, personId: p.id,
      positionId: existing.get(p.id)!.id,
      type: "primary" as const,
      effectiveFrom: p.entry?.hiredAt ?? "2026-01-01",
      effectiveTo: null, referenceNo: "MIGRATION", note: "بازسازی انتصاب اولیه از داده‌های سابق",
    }));
  }
  return state;
}

export function validDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function precedingDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export function overlaps(a: PositionAppointment, b: PositionAppointment): boolean {
  return a.effectiveFrom <= (b.effectiveTo ?? "9999-12-31") &&
    b.effectiveFrom <= (a.effectiveTo ?? "9999-12-31");
}
export function appointmentOn(
  state: DemoState, personId: string, date = new Date().toISOString().slice(0, 10),
): PositionAppointment | undefined {
  return state.appointments.find((a) =>
    a.type === "primary" && a.personId === personId &&
    a.effectiveFrom <= date && (!a.effectiveTo || a.effectiveTo >= date));
}
export function positionHolder(
  state: DemoState, positionId: string, date = new Date().toISOString().slice(0, 10),
): Person | undefined {
  const a = state.appointments.find((a) =>
    a.type === "primary" && a.positionId === positionId &&
    a.effectiveFrom <= date && (!a.effectiveTo || a.effectiveTo >= date));
  return state.people.find((p) => p.id === a?.personId);
}
export function positionOf(state: DemoState, personId: string, date?: string): Position | undefined {
  const a = appointmentOn(state, personId, date);
  return state.positions.find((p) => p.id === a?.positionId);
}
export function managerOf(state: DemoState, personId: string, date?: string): Person | undefined {
  const position = positionOf(state, personId, date);
  return position?.parentPositionId
    ? positionHolder(state, position.parentPositionId, date) : undefined;
}
export function directReports(state: DemoState, personId: string, date?: string): Person[] {
  const pos = positionOf(state, personId, date);
  if (!pos) return [];
  return state.positions
    .filter((p) => p.parentPositionId === pos.id)
    .flatMap((p) => {
      const holder = positionHolder(state, p.id, date);
      return holder ? [holder] : [];
    });
}
export function wouldCycle(positions: Position[], positionId: string, parentId: string | null | undefined): boolean {
  const visited = new Set([positionId]);
  let id = parentId;
  while (id) {
    if (visited.has(id)) return true;
    visited.add(id);
    id = positions.find((p) => p.id === id)?.parentPositionId ?? null;
  }
  return false;
}
export function organizationTree(positions: Position[]): { position: Position; depth: number }[] {
  const result: { position: Position; depth: number }[] = [];
  const visited = new Set<string>();
  const walk = (p: Position, depth: number) => {
    if (visited.has(p.id)) return;
    visited.add(p.id);
    result.push({ position: p, depth });
    positions.filter((c) => c.parentPositionId === p.id)
      .sort((a, b) => a.title.localeCompare(b.title, "fa"))
      .forEach((child) => walk(child, depth + 1));
  };
  for (const p of positions.filter((p) =>
    !p.parentPositionId || !positions.some((x) => x.id === p.parentPositionId)))
    walk(p, 0);
  // Also show invalid historical orphan/cyclic records rather than making them disappear.
  positions.filter((p) => !visited.has(p.id)).forEach((p) => walk(p, 0));
  return result;
}
