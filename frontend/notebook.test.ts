import {describe,it,expect} from 'vitest';
import {addPlayers,emptyNotebooks,parseNotebooks,parseTags,playerId,validNotebookName} from './notebook';
describe('local scouting notebooks',()=>{
 it('keeps save associations and player IDs within their notebook across serialization',()=>{
  const data={...emptyNotebooks(),notebooks:[{id:'a',name:'Career A',lists:[{id:'l',name:'Targets',players:[42]}],notes:{'42':{note:'Scout again',tags:['Priority']}}},{id:'b',name:'Career B',lists:[],notes:{}}],saves:{'/a.fm':'a','/a-copy.fm':'a','/b.fm':'b'}};
  const parsed=parseNotebooks(JSON.parse(JSON.stringify(data)));
  expect(parsed.saves['/a-copy.fm']).toBe('a');
  expect(parsed.notebooks[1].notes['42']).toBeUndefined();
  expect(parsed.notebooks[0].lists[0].players).toEqual([42]);
 });
 it('deduplicates membership and tags without treating missing identity as zero',()=>{
  expect(addPlayers({id:'a',name:'Targets',players:[1]},[1,2,NaN,0,-1])).toEqual({id:'a',name:'Targets',players:[1,2]});
  expect(parseTags(' Loan, loan , Priority, ')).toEqual(['Loan','Priority']);
  expect(playerId({UID:null})).toBeNull();
  expect(playerId({UID:0})).toBeNull();
 });
 it('rejects unreadable storage and duplicate names instead of silently replacing records',()=>{
  expect(()=>parseNotebooks({version:2,notebooks:[],saves:{}})).toThrow();
  expect(()=>parseNotebooks({...emptyNotebooks(),saves:{'/a.fm':'missing'}})).toThrow();
  expect(()=>validNotebookName('targets',[{id:'1',name:'Targets'}])).toThrow();
  expect(validNotebookName(' Targets ',[{id:'1',name:'Targets'}],'1')).toBe('Targets');
  expect(()=>parseTags('x'.repeat(41))).toThrow();
 });
});
