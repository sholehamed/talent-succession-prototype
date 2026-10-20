import { DemoState, PositionRiskInput } from "./models";

export type PositionRiskStatus = "unassessed" | "current" | "stale" | "vacant" | "inactive";
export interface PositionRiskSummary {
  status: PositionRiskStatus;
  score: number | null;
  replacementMonths: number | null;
  reviewedAt: string | null;
}

/**
 * The seed's numeric position fields are demonstration defaults, NOT assessed risk.
 * A review belongs to the current primary appointment. Never confuse the
 * no-ready-successor warning with the turnover-risk score.
 */
export function assessPositionRisk(
  state: DemoState, positionId: string, asOf = new Date().toISOString().slice(0, 10),
): PositionRiskSummary {
  const position = state.positions.find(p => p.id === positionId);
  const review = position?.riskReview;
  const reviewedAt = review?.assessedAt ?? null;
  const result = (status: PositionRiskStatus, valid = false): PositionRiskSummary => ({
    status,
    score: valid ? position!.probability * position!.impact : null,
    replacementMonths: valid ? position!.months : null,
    reviewedAt,
  });
  if (!position || position.isActive === false || !position.critical) return result("inactive");
  const appointment = state.appointments.find(a =>
    a.type === "primary" && a.positionId === position.id &&
    a.effectiveFrom <= asOf && (!a.effectiveTo || a.effectiveTo >= asOf));
  if (!appointment) return result("vacant");
  if (!review) return result("unassessed");
  const reviewedDate = new Date(review.assessedAt);
  const expiry = new Date(reviewedDate.getTime());
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  const validEvidence = [review.probabilityEvidence, review.impactEvidence,
    review.replacementBasis, review.mitigationAction].every(s =>
      typeof s === "string" && !!s.trim());
  if (review.appointmentIdAtReview !== appointment.id ||
    review.horizonMonths !== 12 || !validEvidence ||
    ![position.probability, position.impact].every(v => Number.isInteger(v) && v >= 1 && v <= 3) ||
    !Number.isInteger(position.months) || position.months <= 0 ||
    Number.isNaN(reviewedDate.getTime()) || reviewedDate.toISOString().slice(0, 10) > asOf ||
    expiry.toISOString().slice(0, 10) < asOf) return result("stale");
  return result("current", true);
}

export function validatePositionRiskInput(input: PositionRiskInput): string {
  if (![input.probability, input.impact].every(v =>
    Number.isInteger(v) && v >= 1 && v <= 3))
    return "احتمال و اثر خروج باید اعداد صحیح بین ۱ تا ۳ باشند.";
  if (!Number.isInteger(input.months) || input.months <= 0)
    return "زمان جایگزینی باید تعداد ماه صحیح و بزرگ‌تر از صفر باشد.";
  if ([input.reason, input.probabilityEvidence, input.impactEvidence,
    input.replacementBasis, input.mitigationAction].some(s =>
      typeof s !== "string" || !s.trim()))
    return "دلیل حیاتی‌بودن، شواهد احتمال و اثر، مبنای زمان و اقدام کنترلی الزامی‌اند.";
  return "";
}
