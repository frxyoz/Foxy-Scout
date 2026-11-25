import {useEffect,useId,useMemo,useState} from 'react';
import {Row} from './data';
import {addPlayers,emptyNotebooks,Notebook,NotebookStore,notebookKey,parseNotebooks,parseTags,playerId,validNotebookName} from './notebook';
import './notebook.css';

export function useScoutingNotebook(path: string) {
 const [initial]=useState(()=>{
  try { const raw=localStorage.getItem(notebookKey);return {data:raw?parseNotebooks(JSON.parse(raw)):emptyNotebooks(),error:''}; }
  catch {return {data:emptyNotebooks(),error:'Notebook data could not be read. Existing data has been preserved; notebook changes are disabled.'};}
 });
 const [data,setData]=useState(initial.data),[message,setMessage]=useState(''),[error,setError]=useState(initial.error);
 const book=data.notebooks.find(book=>book.id===data.saves[path]);
 function change(update:(data:NotebookStore)=>NotebookStore,notice:string):boolean {
  if(initial.error||!path)return false;
  try {const next=update(data);localStorage.setItem(notebookKey,JSON.stringify(next));setData(next);setError('');setMessage(notice);return true;}
  catch(e){setError(e instanceof Error?e.message:'Could not save notebook changes.');return false;}
 }
 return {book,books:data.notebooks,message,error,disabled:!!initial.error||!path,
  create:(name:string)=>change(data=>{
   const clean=validNotebookName(name,data.notebooks),id=crypto.randomUUID();
   return {...data,notebooks:[...data.notebooks,{id,name:clean,lists:[],notes:{}}],saves:{...data.saves,[path]:id}};
  },'Notebook created for this save.'),
  choose:(id:string)=>change(data=>{
   if(!data.notebooks.some(book=>book.id===id))throw new Error('Choose an available notebook.');
   return {...data,saves:{...data.saves,[path]:id}};
  },'Notebook linked to this save.'),
  update:(update:(book:Notebook)=>Notebook,notice:string)=>change(data=>{
   if(!book)throw new Error('Create or choose a notebook first.');
   return {...data,notebooks:data.notebooks.map(item=>item.id===book.id?update(item):item)};
  },notice),
 };
}
export type NotebookModel=ReturnType<typeof useScoutingNotebook>;

export function NotebookPanel({model,path,players,activeList,onListChange,tag,onTagChange,matching}: {
 model:NotebookModel;path:string;players:Row[];activeList:string;onListChange:(id:string)=>void;
 tag:string;onTagChange:(tag:string)=>void;matching:Row[];
}) {
 const id=useId();
 const {book}=model;
 const [bookName,setBookName]=useState(''),[listName,setListName]=useState('');
 useEffect(()=>{setListName('');setBookName('');},[book?.id,path]);
 const list=book?.lists.find(list=>list.id===activeList);
 const loaded=useMemo(()=>new Set(players.map(playerId)),[players]);
 const absent=list?.players.filter(id=>!loaded.has(id)).length||0;
 const matchingIds=useMemo(()=>[...new Set(matching.map(playerId).filter((id):id is number=>id!==null))],[matching]);
 const tags=useMemo(()=>[...new Set(Object.values(book?.notes||{}).flatMap(note=>note.tags))].sort((a,b)=>a.localeCompare(b)),[book?.notes]);
 return <details className="notebook-panel">
  <summary>Shortlists &amp; notes{book?` · ${book.name}`:''}</summary>
  <div className="notebook-content">
   <p className="filter-hint">Keep a notebook for each career. Choose an existing notebook for another save from that career.</p>
   <details className="notebook-settings" open={!book}>
   <summary>{book ? 'Manage notebooks' : 'Start a scouting notebook'}</summary>
   <div className="notebook-content">
   {model.books.length>0&&<label>Scouting notebook
    <select aria-label="Scouting notebook" value={book?.id||''} disabled={model.disabled} onChange={e=>{if(e.target.value){model.choose(e.target.value);onListChange('');onTagChange('');}}}>
     <option value="" disabled>Choose a notebook…</option>{model.books.map(book=><option key={book.id} value={book.id}>{book.name}</option>)}
    </select>
   </label>}
   <form className="notebook-inline" onSubmit={e=>{e.preventDefault();if(model.create(bookName)){setBookName('');onListChange('');onTagChange('');}}}>
    <label>New notebook name<input maxLength={80} value={bookName} placeholder={path.split('/').at(-1)?.replace(/\.fm$/i,'')||'My career'} onChange={e=>setBookName(e.target.value)} /></label>
    <button disabled={model.disabled||!bookName.trim()}>Create notebook</button>
   </form>
   </div></details>
   {book&&<>
    <div className="notebook-inline">
     <label>Shortlist view<select aria-label="Shortlist view" value={list?.id||''} onChange={e=>{onListChange(e.target.value);setListName(book.lists.find(list=>list.id===e.target.value)?.name||'');}}>
      <option value="">All players</option>{book.lists.map(list=><option key={list.id} value={list.id}>{list.name} ({list.players.length})</option>)}
     </select></label>
     <label>Player tag<select aria-label="Player tag" value={tag} onChange={e=>onTagChange(e.target.value)}><option value="">Any tag</option>{tags.map(tag=><option key={tag}>{tag}</option>)}</select></label>
    </div>
    <form onSubmit={e=>{e.preventDefault();const newId=crypto.randomUUID();if(model.update(book=>({...book,lists:[...book.lists,{id:newId,name:validNotebookName(listName,book.lists),players:[]}]}),'Shortlist created.'))onListChange(newId);}}>
     <label>Shortlist name<input maxLength={80} value={listName} placeholder="e.g. Summer targets" onChange={e=>setListName(e.target.value)} /></label>
     <div className="notebook-actions">
      <button disabled={!listName.trim()}>Create shortlist</button>
      <button type="button" disabled={!list||!listName.trim()||listName.trim()===list.name} onClick={()=>{if(list)model.update(book=>({...book,lists:book.lists.map(item=>item.id===list.id?{...item,name:validNotebookName(listName,book.lists,item.id)}:item)}),'Shortlist renamed.');}}>Rename shortlist</button>
      <button type="button" disabled={!list} onClick={()=>{if(list&&model.update(book=>({...book,lists:book.lists.filter(item=>item.id!==list.id)}),'Shortlist deleted. Player notes were kept.')){onListChange('');setListName('');}}}>Delete shortlist</button>
     </div>
    </form>
    {list&&<div className="notebook-members">
     <p>{list.players.length.toLocaleString()} saved players{absent?`; ${absent.toLocaleString()} not present in this save`:''}. Applied filters also limit this view.</p>
     <button type="button" disabled={!matchingIds.length} onClick={()=>model.update(book=>({...book,lists:book.lists.map(item=>item.id===list.id?addPlayers(item,matchingIds):item)}),'Matching players added to shortlist.')}>Add matching players to shortlist ({matchingIds.length.toLocaleString()})</button>
    </div>}
    <p className="filter-hint">Open a player report to add a player, write notes or edit tags. Players missing from a later save stay on your shortlist.</p>
   </>}
   <p id={`${id}-status`} role="status" className="notebook-status">{model.message}</p>
   {model.error&&<p className="filter-error" role="alert">{model.error}</p>}
  </div>
 </details>;
}

export function PlayerNotebook({row,model}: {row:Row;model:NotebookModel}) {
 const {book}=model,id=playerId(row),saved=id===null?undefined:book?.notes[String(id)];
 const [note,setNote]=useState(saved?.note||''),[tags,setTags]=useState(saved?.tags.join(', ')||''),[error,setError]=useState('');
 const [target,setTarget]=useState(book?.lists[0]?.id||'');
 const fieldId=useId();
 if(!book)return <p className="notebook-prompt">Create or choose a notebook in “Shortlists &amp; notes” on the player list to keep scouting notes.</p>;
 if(id===null)return <p className="filter-hint">This player has no stable ID, so scouting records cannot be attached.</p>;
 const unsaved=note!==(saved?.note||'')||tags!==(saved?.tags.join(', ')||'');
 return <details className="player-notebook" open>
  <summary>Scouting record · {book.name}</summary>
  <div className="notebook-content">
   {book.lists.length?<div className="notebook-inline">
    <label>Add to shortlist<select aria-label="Add to shortlist" value={target} onChange={e=>setTarget(e.target.value)}>{book.lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
    <button type="button" disabled={!book.lists.some(list=>list.id===target)||book.lists.find(list=>list.id===target)?.players.includes(id)} onClick={()=>model.update(book=>({...book,lists:book.lists.map(list=>list.id===target?addPlayers(list,[id]):list)}),'Player added to shortlist.')}>Add player</button>
   </div>:<p className="filter-hint">Create a shortlist on the player list to save this player.</p>}
   <div className="notebook-actions">{book.lists.filter(list=>list.players.includes(id)).map(list=><button key={list.id} type="button" aria-label={`Remove ${row.Name} from ${list.name}`} onClick={()=>model.update(book=>({...book,lists:book.lists.map(item=>item.id===list.id?{...item,players:item.players.filter(value=>value!==id)}:item)}),'Player removed from shortlist.')}>{list.name} · Remove</button>)}</div>
   <form onSubmit={e=>{e.preventDefault();try{
    const parsed=parseTags(tags);
    if(model.update(book=>{const notes={...book.notes};if(!note.trim()&&!parsed.length)delete notes[String(id)];else notes[String(id)]={note,tags:parsed};return {...book,notes};},'Player notes saved.')){setTags(parsed.join(', '));setError('');}
   }catch(e){setError(String(e instanceof Error?e.message:e));}}}>
    <label htmlFor={`${fieldId}-note`}>Player notes</label>
    <textarea id={`${fieldId}-note`} rows={3} maxLength={10000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Your scouting observations…" />
    <label htmlFor={`${fieldId}-tags`}>Tags (comma-separated)</label>
    <input id={`${fieldId}-tags`} value={tags} aria-invalid={!!error} aria-describedby={error?`${fieldId}-error`:undefined} onChange={e=>{setTags(e.target.value);setError('');}} placeholder="e.g. Priority, Loan option" />
    {error&&<p id={`${fieldId}-error`} role="alert" className="filter-error">{error}</p>}
    <div className="notebook-actions"><button>Save notes</button>{unsaved&&<span className="filter-hint">Unsaved notes</span>}</div>
   </form>
   <p role="status" className="notebook-status">{model.message}</p>
   {model.error&&<p role="alert" className="filter-error">{model.error}</p>}
  </div>
 </details>;
}
