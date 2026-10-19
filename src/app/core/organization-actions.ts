import {
  DemoState, OrganizationUnit, WorkLocation, Position, PositionAppointment,
} from "./models";
import {
  appointmentOn, managerOf, overlaps, positionHolder, positionOf,
  precedingDay, validDay, wouldCycle,
} from "./organization";

/** Pure state transitions. Return a Persian validation message, or "" on success. */
export function saveLocation(state: DemoState, draft: WorkLocation): string {
  const name = draft.name.trim(), code = draft.code.trim();
  if (!name || !code || state.workLocations.some((x) =>
    x.id !== draft.id && (x.code === code || x.name === name)))
    return "نام و کد محل خدمت باید معتبر و یکتا باشند.";
  if (draft.isActive === false && state.positions.some((p) =>
    p.locationId === draft.id && p.isActive !== false))
    return "محل خدمت دارای پست فعال قابل غیرفعال‌کردن نیست.";
  const row: WorkLocation = { ...draft, name, code, isActive: draft.isActive !== false };
  const i = state.workLocations.findIndex((x) => x.id === row.id);
  if (i >= 0) state.workLocations[i] = row;
  else state.workLocations.push(row);
  return "";
}
export function saveUnit(state: DemoState, draft: OrganizationUnit): string {
  const name = draft.name.trim(), code = draft.code.trim();
  if (!name || !code || state.organizationUnits.some((x) =>
    x.id !== draft.id && (x.code === code ||
    (x.name === name && x.parentUnitId === draft.parentUnitId))))
    return "نام و کد واحد سازمانی باید معتبر و یکتا باشند.";
  if (draft.parentUnitId &&
    !state.organizationUnits.some((x) => x.id === draft.parentUnitId && x.isActive))
    return "واحد بالاسری پیدا نشد یا غیرفعال است.";
  const visited = new Set([draft.id]);
  let parent = draft.parentUnitId;
  while (parent) {
    if (visited.has(parent)) return "ساختار واحد سازمانی نمی‌تواند چرخه داشته باشد.";
    visited.add(parent);
    parent = state.organizationUnits.find((x) => x.id === parent)?.parentUnitId ?? null;
  }
  if (draft.isActive === false &&
    (state.organizationUnits.some((x) => x.parentUnitId === draft.id && x.isActive) ||
    state.positions.some((p) => p.unitId === draft.id && p.isActive !== false)))
    return "ابتدا زیرواحدها یا پست‌های فعال را جابه‌جا کنید.";
  const row: OrganizationUnit = { ...draft, name, code, isActive: draft.isActive !== false };
  const i = state.organizationUnits.findIndex((x) => x.id === row.id);
  if (i >= 0) state.organizationUnits[i] = row;
  else state.organizationUnits.push(row);
  // The organization unit is the source of truth for position placement.
  // Sync legacy labels as well so existing People/IDP/dashboard views remain coherent.
  for (const position of state.positions) {
    if (position.unitId === row.id) position.unit = row.name;
  }
  projectStaffing(state);
  return "";
}
export function savePosition(state: DemoState, draft: Position): string {
  const parent = draft.parentPositionId ?? null;
  if (!draft.title.trim() || !draft.code?.trim() ||
    state.positions.some((p) => p.id !== draft.id && p.code === draft.code) ||
    !state.jobs.some((j) => j.id === draft.jobId && j.version > 0) ||
    !state.organizationUnits.some((u) => u.id === draft.unitId && u.isActive) ||
    !state.workLocations.some((l) => l.id === draft.locationId && l.isActive) ||
    (parent !== null && !state.positions.some((p) => p.id === parent && p.isActive !== false)) ||
    wouldCycle(state.positions, draft.id, parent))
    return "پست، شغل، واحد، محل خدمت یا بالاسری نامعتبر است؛ چرخه مجاز نیست.";
  const old = state.positions.find((p) => p.id === draft.id);
  if (old && state.appointments.some((a) =>
      a.positionId === old.id && a.type === "primary" && !a.effectiveTo) &&
    (old.jobId !== draft.jobId || draft.isActive === false))
    return "برای تغییر شغل یا غیرفعال‌کردن پست متصدی‌دار، ابتدا انتصاب را پایان دهید.";
  if (draft.isActive === false && state.positions.some((p) =>
    p.parentPositionId === draft.id && p.isActive !== false))
    return "پست دارای پست زیرمجموعه فعال را نمی‌توان غیرفعال کرد.";
  const row: Position = {
    ...draft, title: draft.title.trim(), code: draft.code!.trim(),
    unit: state.organizationUnits.find((u) => u.id === draft.unitId)!.name,
    parentPositionId: parent, isActive: draft.isActive !== false,
    holderId: old?.holderId ?? "",
  };
  const i = state.positions.findIndex((x) => x.id === row.id);
  if (i >= 0) state.positions[i] = row;
  else state.positions.push(row);
  projectStaffing(state);
  return "";
}
export function assignPosition(
  state: DemoState, row: PositionAppointment,
): string {
  if (!state.people.some((p) => p.id === row.personId) ||
    !state.positions.some((p) => p.id === row.positionId && p.isActive !== false) ||
    !validDay(row.effectiveFrom) || row.type !== "primary")
    return "فرد، پست فعال یا تاریخ انتصاب معتبر نیست.";
  const current = appointmentOn(state, row.personId, row.effectiveFrom);
  if (current && (current.positionId === row.positionId ||
    current.effectiveFrom >= row.effectiveFrom))
    return "انتصاب تکراری یا تاریخ انتقال نامعتبر است.";
  const conflicts = state.appointments.filter((a) =>
    a.type === "primary" && a.id !== current?.id && overlaps(a, row) &&
    (a.personId === row.personId || a.positionId === row.positionId));
  if (conflicts.length || state.appointments.some((a) =>
    a.type === "primary" && a.positionId === row.positionId && overlaps(a, row)))
    return "پست متصدی دارد یا فرد دارای انتصاب هم‌پوشان است.";
  if (current) current.effectiveTo = precedingDay(row.effectiveFrom);
  state.appointments.push(row);
  projectStaffing(state);
  return "";
}
export function finishAppointment(state: DemoState, id: string, date: string): string {
  const a = state.appointments.find((a) => a.id === id);
  if (!a || !validDay(date) || date < a.effectiveFrom || a.effectiveTo)
    return "انتصاب جاری یا تاریخ پایان معتبر نیست.";
  a.effectiveTo = date;
  projectStaffing(state);
  return "";
}
/** Keep transitional Person and Position fields coherent for legacy views. */
export function projectStaffing(state: DemoState) {
  const today = new Date().toISOString().slice(0, 10);
  for (const pos of state.positions) pos.holderId = positionHolder(state, pos.id, today)?.id ?? "";
  for (const person of state.people) {
    const pos = positionOf(state, person.id, today);
    if (!pos) continue;
    person.jobId = pos.jobId;
    person.unit = state.organizationUnits.find((u) => u.id === pos.unitId)?.name ?? pos.unit;
    person.managerId = managerOf(state, person.id, today)?.id ?? "";
  }
}
