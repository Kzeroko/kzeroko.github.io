/**
 * Browser-local sessions. Metadata and workspaces live in separate stores so the session list
 * never has to load thousands of dialogues just to show names and sizes.
 */
const DB = 'isekai-dialogue-studio', META = 'sessions', DATA = 'workspaces';

const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

export class SessionStore {
  async open() {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined') throw Error('IndexedDB unavailable');
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA);
    };
    this.db = await request(req);
    return this.db;
  }

  async transaction(stores, mode, fn) {
    const db = await this.open(), tx = db.transaction(stores, mode);
    const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? Error('Storage transaction aborted')); });
    const result = await fn(...stores.map(name => tx.objectStore(name)));
    await done;
    return result;
  }

  async list() {
    const items = await this.transaction([META], 'readonly', store => request(store.getAll()));
    return items.sort((a, b) => b.updated - a.updated);
  }

  async load(id) { return this.transaction([DATA], 'readonly', store => request(store.get(id))); }

  async save(meta, workspace) {
    await this.transaction([META, DATA], 'readwrite', (metaStore, dataStore) => {
      metaStore.put(meta); dataStore.put(workspace, meta.id);
    });
  }

  async rename(id, name) {
    await this.transaction([META], 'readwrite', async store => {
      const meta = await request(store.get(id));
      if (meta) store.put({ ...meta, name, updated: Date.now() });
    });
  }

  async remove(ids) {
    await this.transaction([META, DATA], 'readwrite', (metaStore, dataStore) => {
      for (const id of ids) { metaStore.delete(id); dataStore.delete(id); }
    });
  }
}

export const newSessionId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
