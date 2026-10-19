/** Suggested actions per competency; editable by HR/manager after selection.
 *  Templates are guidance, not a claim of validated psychometrics. */
export interface DevelopmentTemplate {
  id: string;
  competency: number;
  title: string;
  kind: string;
  indicator: string;
  isActive: boolean;
}
const initialTemplates: Omit<DevelopmentTemplate, "isActive">[] = [
  { id: "communication-brief", competency: 0, title: "ارائه گزارش وضعیت پروژه به ذی‌نفعان", kind: "تجربه عملی", indicator: "ارائه دو گزارش ساختاریافته و دریافت بازخورد مکتوب از ذی‌نفعان" },
  { id: "communication-coaching", competency: 0, title: "مربیگری در گفت‌وگوی اثربخش", kind: "مربیگری", indicator: "چهار جلسه مربیگری و ثبت نمونه بازخورد پیش و پس از جلسات" },
  { id: "collaboration-cross", competency: 1, title: "هدایت یک مسئله مشترک بین واحدها", kind: "تجربه عملی", indicator: "ثبت توافق مسئولیت‌ها و تأیید نتیجه توسط دو واحد درگیر" },
  { id: "collaboration-retro", competency: 1, title: "تسهیل جلسه بازنگری تیمی", kind: "یادگیری گروهی", indicator: "برگزاری دو جلسه و ثبت حداقل سه اقدام پذیرفته‌شده توسط تیم" },
  { id: "problem-rootcause", competency: 2, title: "تحلیل ریشه‌ای یک مسئله عملیاتی", kind: "پروژه عملی", indicator: "ثبت تحلیل ریشه‌ای، گزینه‌ها و نتیجه اقدام اصلاحی" },
  { id: "problem-workshop", competency: 2, title: "کارگاه حل مسئله مبتنی بر داده", kind: "آموزش", indicator: "ارائه یک مطالعه موردی با معیار تصمیم و بازبینی توسط مدیر" },
  { id: "accountability-delivery", competency: 3, title: "مالکیت یک خروجی با معیار پذیرش روشن", kind: "تجربه عملی", indicator: "تحویل خروجی طبق موعد و تأیید کیفیت توسط ذی‌نفع" },
  { id: "accountability-followup", competency: 3, title: "طراحی چرخه پیگیری تعهدات", kind: "مربیگری", indicator: "گزارش چهار نوبت پیگیری همراه با اقدامات اصلاحی انجام‌شده" },
  { id: "leadership-delegate", competency: 4, title: "راهبری تیم کوچک و تفویض مسئولیت", kind: "مأموریت عملی", indicator: "توزیع مسئولیت‌ها، تحقق دو خروجی و بازخورد اعضای تیم" },
  { id: "leadership-mentor", competency: 4, title: "مربیگری یکی از اعضای تیم", kind: "مربیگری", indicator: "ثبت برنامه چهار جلسه‌ای و ارزیابی پیشرفت فرد تحت مربیگری" },
];
/** Seed and migration defaults only. Runtime selections always use the Store catalog. */
export function defaultDevelopmentTemplates(): DevelopmentTemplate[] {
  return initialTemplates.map((template) => ({ ...template, isActive: true }));
}
export function templatesForCompetency(
  templates: DevelopmentTemplate[], competency: number, includeInactive = false,
): DevelopmentTemplate[] {
  return templates.filter((item) =>
    item.competency === competency && (includeInactive || item.isActive));
}
