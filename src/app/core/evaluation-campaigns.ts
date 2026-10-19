import {
  Assignment, CampaignScope, Cycle, DemoState, EvaluationCampaign, Group, Person,
} from "./models";
import { appointmentOn, positionHolder, positionOf, validDay } from "./organization";
import { orderedQuestions } from "./evaluation-questions";

/** Read-only selection preview; creating the period enrolls eligible people in preparing. */
export interface CampaignPreviewRow {
  personId: string;
  positionId?: string;
  jobId?: string;
  unitId?: string;
  locationId?: string;
  managerId?: string;
  assignments: Pick<Assignment, "personId" | "group">[];
  requiredGroups: Partial<Record<Group, number>>;
  notes: string[];
  reason?: string;
}

function scopedPeople(state: DemoState, scope: CampaignScope, day: string): Person[] {
  const ids = new Set(scope.ids);
  const unitIds = new Set(scope.ids);
  if (scope.type === "unit") {
    let prev = -1;
    while (prev !== unitIds.size) {
      prev = unitIds.size;
      state.organizationUnits.forEach((u) => {
        if (u.parentUnitId && unitIds.has(u.parentUnitId)) unitIds.add(u.id);
      });
    }
  }
  return state.people.filter((person) => {
    if (scope.type === "people") return ids.has(person.id);
    const position = positionOf(state, person.id, day);
    if (!position || position.isActive === false) return false;
    if (scope.type === "all") return true;
    if (scope.type === "job") return ids.has(position.jobId);
    return !!position.unitId && unitIds.has(position.unitId);
  });
}

export function campaignPreview(
  state: DemoState,
  campaign: Pick<EvaluationCampaign, "scope" | "period" | "asOf" | "mode">,
): CampaignPreviewRow[] {
  if (!validDay(campaign.asOf)) return [];
  const people = scopedPeople(state, campaign.scope, campaign.asOf);
  const day = campaign.asOf;
  return people.map((person): CampaignPreviewRow => {
    const position = positionOf(state, person.id, day);
    const base: CampaignPreviewRow = {
      personId: person.id, assignments: [], requiredGroups: {}, notes: [],
    };
    if (!position || position.isActive === false || !appointmentOn(state, person.id, day))
      return { ...base, reason: "در تاریخ مبنا انتصاب فعال و معتبر ندارد." };
    const job = state.jobs.find((j) => j.id === position.jobId && j.version > 0);
    if (!job) return { ...base, reason: "شناسنامه شغلی منتشرشده در دسترس نیست." };
    if (state.cycles.some((c) => c.subjectId === person.id &&
      c.period === campaign.period && c.mode === campaign.mode))
      return { ...base, reason: "برای این فرد، دوره و نوع ارزیابی قبلاً پرونده وجود دارد." };

    const seen = new Set([person.id]);
    const result: CampaignPreviewRow = {
      ...base, positionId: position.id, jobId: position.jobId,
      unitId: position.unitId, locationId: position.locationId,
    };
    const pick = (id: string | undefined, group: Group) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      result.assignments.push({ personId: id, group });
      return true;
    };
    const supervisor = position.parentPositionId
      ? positionHolder(state, position.parentPositionId, day) : undefined;
    if (supervisor && pick(supervisor.id, "supervisor")) {
      result.managerId = supervisor.id;
      result.requiredGroups.supervisor = 1;
    } else result.notes.push("سرپرست شاغل در پست بالاسری وجود ندارد.");

    const peers = state.positions.filter((p) => p.isActive !== false &&
      !!position.parentPositionId && p.parentPositionId === position.parentPositionId &&
      p.id !== position.id).flatMap((p) => {
        const occupant = positionHolder(state, p.id, day);
        return occupant && !seen.has(occupant.id) ? [occupant.id] : [];
      });
    // Do not create a confidential peer/subordinate group with just one member.
    if (peers.length >= 2) {
      peers.slice(0, 4).forEach((id) => pick(id, "peer"));
      result.requiredGroups.peer = 2;
    } else if (peers.length) result.notes.push("هم‌سطح‌های معتبر کمتر از دو نفر هستند.");

    const subordinates = state.positions.filter((p) => p.isActive !== false &&
      p.parentPositionId === position.id).flatMap((p) => {
        const occupant = positionHolder(state, p.id, day);
        return occupant && !seen.has(occupant.id) ? [occupant.id] : [];
      });
    if (subordinates.length >= 2) {
      subordinates.slice(0, 4).forEach((id) => pick(id, "subordinate"));
      result.requiredGroups.subordinate = 2;
    } else if (subordinates.length) result.notes.push("زیردستان معتبر کمتر از دو نفر هستند.");

    if (campaign.mode === 540)
      result.reason = "ذی‌نفع بیرونی ۵۴۰ از چارت سازمانی قابل استنتاج نیست؛ مدل روابط معتبر هنوز وجود ندارد.";
    if (!result.assignments.length)
      result.reason = result.reason ?? "هیچ گروه ارزیاب معتبر و قابل گزارش پیدا نشد.";
    const groups = new Set(result.assignments.map((a) => a.group));
    if (!result.reason && [...groups].some((g) =>
      !orderedQuestions(state.questions, g).length))
      result.reason = "بانک سؤال فعال برای یکی از گروه‌های انتخاب‌شده خالی است.";
    return result;
  });
}

/** Create a prepared individual cycle; do not expose work to evaluator inbox yet. */
export function campaignCycle(
  campaign: EvaluationCampaign, row: CampaignPreviewRow,
  state: DemoState,
): Cycle {
  if (!row.positionId || !row.jobId || row.reason) throw new Error("Invalid campaign row");
  const groups = new Set(row.assignments.map((a) => a.group));
  return {
    id: crypto.randomUUID(), campaignId: campaign.id,
    title: campaign.title, period: campaign.period, subjectId: row.personId,
    jobId: row.jobId, mode: campaign.mode, status: "preparing",
    assignments: row.assignments.map((a) => ({ ...a, id: crypto.randomUUID() })),
    requiredGroups: { ...row.requiredGroups },
    organizationSnapshot: {
      asOf: campaign.asOf, positionId: row.positionId,
      unitId: row.unitId ?? "", locationId: row.locationId ?? "",
      ...(row.managerId ? { managerId: row.managerId } : {}),
    },
    questions: structuredClone(state.questions.filter((q) =>
      q.isActive && groups.has(q.group))),
    notes: "", created: new Date().toISOString(),
  };
}
