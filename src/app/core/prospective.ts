import {
  ProspectiveIndicator, ProspectiveQuestion, QuestionAnswer,
} from "./models";

/** Illustrative prompts only; NOT a validated personality or aptitude instrument. */
export function defaultProspectiveIndicators(): ProspectiveIndicator[] {
  const titles=[
    ["چابکی یادگیری","یادگیری از تجربه‌های تازه و دریافت بازخورد"],
    ["نگاه آینده‌نگر","توجه به سناریوهای آینده و پیامدهای بلندمدت"],
    ["سازگاری با تغییر","انعطاف در مواجهه با تغییر و عدم قطعیت"],
    ["تصمیم‌گیری در ابهام","سنجش گزینه‌ها در نبود اطلاعات کامل"],
    ["انگیزه رشد","پیگیری مسئولانه فرصت‌های رشد و یادگیری"],
  ];
  return titles.map(([title,description],i)=>({
    id:"pros-ind-"+(i+1),title,description,order:i,isActive:true,
  }));
}
export function defaultProspectiveQuestions(): ProspectiveQuestion[] {
  const texts=[
    ["در تجربه‌ای جدید، چه میزان برای یادگیری و بازنگری روش خود اقدام می‌کند؟","چقدر از بازخورد برای بهبود تصمیم بعدی استفاده می‌کند؟"],
    ["تا چه اندازه پیامدهای بلندمدت تصمیم‌هایش را بررسی می‌کند؟","در برنامه‌ریزی، چه میزان سناریوهای جایگزین آینده را در نظر می‌گیرد؟"],
    ["با تغییر اولویت‌ها چقدر سازگار و اثربخش عمل می‌کند؟","در مواجهه با شرایط تازه، تا چه حد راهکار عملی جدید می‌یابد؟"],
    ["وقتی داده کافی نیست، چقدر فرض‌ها و ریسک تصمیم را روشن می‌کند؟","تا چه حد میان گزینه‌ها با شواهد محدود تصمیم سنجیده می‌گیرد؟"],
    ["چقدر برای فرصت‌های یادگیری و مسئولیت بیشتر پیش‌قدم می‌شود؟","تا چه حد هدف توسعه فردی را به اقدام مشخص تبدیل می‌کند؟"],
  ];
  return texts.flatMap((items,i)=>items.map((text,j)=>({
    id:"pros-q-"+(i+1)+"-"+(j+1),
    indicatorId:"pros-ind-"+(i+1),text,order:j,isActive:true,
  })));
}
export function activeProspectiveBank(indicators:ProspectiveIndicator[],questions:ProspectiveQuestion[]) {
  const active=indicators.filter(i=>i.isActive).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const ids=new Set(active.map(i=>i.id));
  const questionsActive=questions.filter(q=>q.isActive&&ids.has(q.indicatorId))
    .sort((a,b)=>active.findIndex(i=>i.id===a.indicatorId)-active.findIndex(i=>i.id===b.indicatorId)
      ||a.order-b.order||a.id.localeCompare(b.id));
  return {indicators:active,questions:questionsActive};
}
export function prospectiveSnapshotError(indicators:ProspectiveIndicator[],questions:ProspectiveQuestion[]):string|null{
  if(!indicators.length)return "حداقل یک شاخص فعال برای آغاز ارزیابی الزامی است.";
  if(new Set(indicators.map(i=>i.id)).size!==indicators.length||
    indicators.some(i=>!i.title.trim()))return "شناسه و عنوان شاخص‌ها باید معتبر و یکتا باشد.";
  if(!questions.length||new Set(questions.map(q=>q.id)).size!==questions.length||
    questions.some(q=>!q.text.trim() || !indicators.some(i=>i.id===q.indicatorId)) ||
    indicators.some(i=>!questions.some(q=>q.indicatorId===i.id)))
    return "برای تمام شاخص‌های فعال حداقل یک سؤال معتبر لازم است.";
  return null;
}
const round1=(v:number)=>Math.round(v*10)/10;
/** Equal question weighting within indicators; equal INDICATOR weighting in the total. */
export function scoreProspectiveAnswers(
  indicators:ProspectiveIndicator[],questions:ProspectiveQuestion[],answers:QuestionAnswer[],
):{indicatorScores:{indicatorId:string;score:number}[];score:number}|null{
  if(prospectiveSnapshotError(indicators,questions) || !Array.isArray(answers) ||
    answers.length!==questions.length || new Set(answers.map(a=>a.questionId)).size!==answers.length)
    return null;
  const map=new Map(answers.map(a=>[a.questionId,a.score]));
  if(questions.some(q=>{
    const v=map.get(q.id); return !Number.isInteger(v)||v!<1||v!>5;
  }))return null;
  const indicatorScores=indicators.map(i=>{
    const qs=questions.filter(q=>q.indicatorId===i.id);
    return {indicatorId:i.id,
      score:round1(qs.reduce((sum,q)=>sum+map.get(q.id)!,0)/qs.length)};
  });
  return {indicatorScores,score:round1(indicatorScores.reduce((sum,i)=>sum+i.score,0)/indicatorScores.length)};
}
