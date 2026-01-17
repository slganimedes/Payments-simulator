import { nextId } from '../db.js';

export function newId(db, key, prefix) {
  return nextId(db, key, prefix);
}
