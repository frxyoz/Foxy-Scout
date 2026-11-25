import { Row } from './data';

export type Shortlist = { id: string; name: string; players: number[] };
export type PlayerNote = { note: string; tags: string[] };
export type Notebook = { id: string; name: string; lists: Shortlist[]; notes: Record<string, PlayerNote> };
export type NotebookStore = { version: 1; notebooks: Notebook[]; saves: Record<string, string> };
export const notebookKey = 'foxy-notebooks-v1';
export const emptyNotebooks = (): NotebookStore => ({ version: 1, notebooks: [], saves: {} });
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
export const playerId = (row: Row): number | null => Number.isSafeInteger(row.UID) && row.UID > 0 ? row.UID : null;
export function parseTags(value: string): string[] {
  const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
  if (tags.some(tag => tag.length > 40) || tags.length > 20) throw new Error('Use up to 20 tags, each at most 40 characters.');
  return tags.filter((tag, i) => tags.findIndex(other => other.toLowerCase() === tag.toLowerCase()) === i);
}
export function validNotebookName(name: string, others: {id: string; name: string}[], except = ''): string {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error('Enter a name with 1–80 characters.');
  if (others.some(other => other.id !== except && other.name.toLowerCase() === clean.toLowerCase())) throw new Error('That name is already used. Choose another name.');
  return clean;
}
export function parseNotebooks(value: unknown): NotebookStore {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.notebooks) || !object(value.saves)) throw new Error('Unsupported notebook data.');
  const notebooks: Notebook[] = [];
  for (const entry of value.notebooks) {
    if (!object(entry) || !text(entry.id, 100) || !entry.id || !text(entry.name, 80) || !entry.name.trim() || !Array.isArray(entry.lists) || !object(entry.notes)) throw new Error('Invalid notebook data.');
    if (notebooks.some(book => book.id === entry.id)) throw new Error('Duplicate notebook identity.');
    const lists: Shortlist[] = [];
    for (const list of entry.lists) {
      if (!object(list) || !text(list.id, 100) || !list.id || !text(list.name, 80) || !list.name.trim() || !Array.isArray(list.players)
        || !list.players.every(id => Number.isSafeInteger(id) && id > 0) || lists.some(other => other.id === list.id)) throw new Error('Invalid shortlist data.');
      lists.push({id:list.id, name:list.name, players:[...new Set(list.players)]});
    }
    const notes: Record<string, PlayerNote> = Object.create(null);
    for (const [id, note] of Object.entries(entry.notes)) {
      if (!/^\d+$/.test(id) || !object(note) || !text(note.note, 10000) || !Array.isArray(note.tags) || note.tags.length > 20 || !note.tags.every(tag => text(tag, 40))) throw new Error('Invalid player notes.');
      notes[id] = {note:note.note, tags:parseTags(note.tags.join(','))};
    }
    notebooks.push({id:entry.id, name:entry.name, lists, notes});
  }
  const saves: Record<string,string> = Object.create(null);
  for (const [path, id] of Object.entries(value.saves)) {
    if (!text(id,100) || !notebooks.some(book => book.id === id)) throw new Error('Invalid save association.');
    saves[path] = id;
  }
  return {version:1, notebooks, saves};
}
export function addPlayers(list: Shortlist, ids: number[]): Shortlist {
  return {...list, players:[...new Set([...list.players, ...ids.filter(id => Number.isSafeInteger(id) && id > 0)])]};
}
