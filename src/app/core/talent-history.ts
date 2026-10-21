import type { Band, DemoState, Person, TalentPositionEvent } from "./models";

/**
 * Keep the nine-box history based on already-visible person classifications.
 * Initial/legacy values are baseline observations as of first use, never
 * fabricated observations at an earlier date.
 */
export function talentBaseline(people: Person[], at: string): TalentPositionEvent[] {
  return people.map(p=>({
    id: "talent-baseline-"+p.id,
    personId:p.id,at,performance:p.performance,potential:p.potential,
    unit:p.unit,source:"baseline" as const,
  }));
}
/** Migrate old LocalStorage snapshots without changing any existing records. */
export function hydrateTalentHistory(state:DemoState,at:string):DemoState{
  const events=Array.isArray(state.talentHistory)?state.talentHistory:[];
  const represented=new Set(events.map(e=>e.personId));
  state.talentHistory=[
    ...events,
    ...talentBaseline(state.people.filter(p=>!represented.has(p.id)),at),
  ];
  return state;
}
/** Called once per existing Store.commit, after the domain mutation. */
export function captureTalentChanges(before:DemoState,after:DemoState,at:string,action:string):void{
  const old=new Map(before.people.map(p=>[p.id,p]));
  for(const person of after.people){
    const previous=old.get(person.id);
    if(previous?.performance===person.performance &&
      previous.potential===person.potential && previous.unit===person.unit)continue;
    // Do not manufacture an earlier baseline when onboarding a new employee.
    after.talentHistory.push({
      id:crypto.randomUUID(),personId:person.id,at,
      performance:person.performance,potential:person.potential,unit:person.unit,
      source:previous?"change":"baseline",action,
    });
  }
}
/** A date boundary includes the entire local calendar day. */
export function nineBoxAt(events:TalentPositionEvent[],personId:string,day:string)
  :TalentPositionEvent|undefined{
  const end=new Date(day+"T23:59:59.999").getTime();
  if(!Number.isFinite(end))return undefined;
  return events.filter(e=>e.personId===personId && Number.isFinite(Date.parse(e.at)) &&
    Date.parse(e.at)<=end)
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
}
export type NineBoxMovement = "improved"|"declined"|"mixed"|"unchanged"|"insufficient";
export interface NineBoxChange {
  person:Person;
  from?:TalentPositionEvent;
  to?:TalentPositionEvent;
  movement:NineBoxMovement;
}
/** Axes are independent; opposite-direction movements are explicitly mixed. */
export function nineBoxMovement(from?:TalentPositionEvent,to?:TalentPositionEvent):NineBoxMovement{
  if(!from || !to || !from.performance||!from.potential||!to.performance||!to.potential)
    return "insufficient";
  const rank:Record<Band,number>={low:1,medium:2,high:3};
  const performance=rank[to.performance]-rank[from.performance];
  const potential=rank[to.potential]-rank[from.potential];
  if(!performance&&!potential)return "unchanged";
  if(performance>=0&&potential>=0)return "improved";
  if(performance<=0&&potential<=0)return "declined";
  return "mixed";
}
export function nineBoxChanges(state:DemoState,people:Person[],fromDay:string,toDay:string):NineBoxChange[]{
  return people.map(person=>{
    const from=nineBoxAt(state.talentHistory,person.id,fromDay);
    const to=nineBoxAt(state.talentHistory,person.id,toDay);
    return {person,from,to,movement:nineBoxMovement(from,to)};
  });
}
export function formatNineBoxCell(event?:TalentPositionEvent):string{
  if(!event?.performance||!event?.potential)return "فاقد داده معتبر";
  // The only authoritative title mapping stays in the current nine-box UI.
  return `${event.performance}-${event.potential}`;
}
