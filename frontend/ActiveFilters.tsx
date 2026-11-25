import {columnLabel,defaults,Filters} from './data';
import {StaffFilters} from './SavedSearches';
type Chip={id:string;label:string;remove:()=>void};
export function ActiveFilters({mode,players,staff,currency,onPlayerChange,onStaffChange,extra,onClear}: {
 mode:string;players:Filters;staff:StaffFilters;currency:string;
 onPlayerChange:(change:(filters:Filters)=>Filters)=>void;
 onStaffChange:(change:(filters:StaffFilters)=>StaffFilters)=>void;
 extra?:Chip[];onClear:()=>void;
}) {
 const chips:Chip[]=[];
 const player=<K extends keyof Filters>(key:K,value:Filters[K],label:string)=>chips.push({id:String(key),label,remove:()=>onPlayerChange(f=>({...f,[key]:value}))});
 const worker=<K extends keyof StaffFilters>(key:K,value:StaffFilters[K],label:string)=>chips.push({id:String(key),label,remove:()=>onStaffChange(f=>({...f,[key]:value}))});
 if(mode==='Players'){
  if(players.search)player('search','',`Search: ${players.search}`);
  if(players.club.trim())player('club','',`Club: ${players.club}`);
  for(const [key,label] of [['age','Age'],['ca','Current ability'],['pa','Potential ability'],['rating','Role rating'],['potential','Potential role rating']] as const){
   if(players[key].some((value,index)=>value!==defaults[key][index]))player(key,defaults[key],`${label}: ${players[key][0]}–${players[key][1]}`);
  }
  for(const key of ['positions','nations'] as const)for(const value of players[key])chips.push({id:`${key}-${value}`,label:`${key==='positions'?'Position':'Nationality'}: ${value}`,remove:()=>onPlayerChange(f=>({...f,[key]:f[key].filter(item=>item!==value)}))});
  if(players.min||players.max)chips.push({id:'price',label:`${columnLabel(players.basis)}: ${currency} ${players.min||0}M–${players.max?`${players.max}M`:'unlimited'}`,remove:()=>onPlayerChange(f=>({...f,min:0,max:0}))});
  if(players.scenario!==defaults.scenario)player('scenario',defaults.scenario,`Eligibility: ${players.scenario}`);
  if(players.listing!=='All')player('listing','All',`Listing: ${players.listing}`);
  if(players.contract!=='All'||players.contractFrom||players.contractTo)chips.push({id:'contract',label:players.contract==='All'?`Contract: ${players.contractFrom||'any date'} to ${players.contractTo||'any date'}`:`Contract: ${players.contract}`,remove:()=>onPlayerChange(f=>({...f,contract:'All',contractFrom:'',contractTo:''}))});
 }else{
  if(staff.search)worker('search','',`Search: ${staff.search}`);
  if(staff.age[0]!==18||staff.age[1]!==80)worker('age',[18,80],`Age: ${staff.age[0]}–${staff.age[1]}`);
  if(staff.attr!=='Attacking'||staff.min!==1)chips.push({id:'attribute',label:`${staff.attr}: at least ${staff.min}`,remove:()=>onStaffChange(f=>({...f,attr:'Attacking',min:1}))});
  for(const value of staff.nations)chips.push({id:`nation-${value}`,label:`Nationality: ${value}`,remove:()=>onStaffChange(f=>({...f,nations:f.nations.filter(item=>item!==value)}))});
 }
 const rules=mode==='Players'?players.columnRules:staff.columnRules;
 const operators:Record<string,string>={gte:'≥',lte:'≤',gt:'>',lt:'<',number_eq:'=',number_ne:'≠',eq:'equals',ne:'does not equal',not_contains:'does not contain',starts:'starts with',ends:'ends with',empty:'is missing',present:'is available',boolean:'is'};
 rules.forEach((rule,index)=>chips.push({id:`condition-${index}`,label:`${columnLabel(rule.column)} ${operators[rule.operator]||rule.operator} ${['empty','present'].includes(rule.operator)?'':rule.value}`.trim(),remove:()=>{
  if(mode==='Players')onPlayerChange(f=>({...f,columnRules:f.columnRules.filter((_,i)=>i!==index)}));
  else onStaffChange(f=>({...f,columnRules:f.columnRules.filter((_,i)=>i!==index)}));
 }}));
 chips.push(...(extra||[]));
 if(!chips.length)return null;
 return <nav className="active-filters" aria-label="Active filters"><span>Applied filters</span>{chips.map(chip=><button type="button" key={chip.id} aria-label={`Remove filter: ${chip.label}`} title="Remove this filter" onClick={chip.remove}>{chip.label} · Remove</button>)}<button type="button" className="text-button" onClick={onClear}>Clear all filters</button></nav>;
}
