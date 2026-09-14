/* IndexedDBラッパー：写真・チェックリスト・設定をオフライン保存する */
const YutecDB = (() => {
  const DB_NAME = 'yutec-photo-db';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
          store.createIndex('synced', 'synced');
          store.createIndex('kojiName', 'kojiName');
        }
        if (!db.objectStoreNames.contains('checklist')) {
          db.createObjectStore('checklist', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function addPhoto(photo) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const req = tx.objectStore('photos').add({ ...photo, synced: 0, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAllPhotos() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const req = tx.objectStore('photos').getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function countUnsynced() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const idx = tx.objectStore('photos').index('synced');
      const req = idx.getAll(0);
      req.onsuccess = () => resolve(req.result.length);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function markSynced(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) return resolve();
        rec.synced = 1;
        const putReq = store.put(rec);
        putReq.onsuccess = () => resolve();
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  async function deletePhoto(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const req = tx.objectStore('photos').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function setSetting(key, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getSetting(key, fallback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function setChecklist(items) {
    const db = await open();
    const tx = db.transaction('checklist', 'readwrite');
    const store = tx.objectStore('checklist');
    await new Promise((res) => { const r = store.clear(); r.onsuccess = res; });
    for (const item of items) store.add(item);
    return new Promise((resolve) => { tx.oncomplete = resolve; });
  }

  async function getChecklist() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checklist', 'readonly');
      const req = tx.objectStore('checklist').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function updateChecklistItem(id, done) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checklist', 'readwrite');
      const store = tx.objectStore('checklist');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) return resolve();
        rec.done = done;
        const putReq = store.put(rec);
        putReq.onsuccess = () => resolve();
        putReq.onerror = (e) => reject(e.target.error);
      };
    });
  }

  return {
    addPhoto, getAllPhotos, countUnsynced, markSynced, deletePhoto,
    setSetting, getSetting, setChecklist, getChecklist, updateChecklistItem
  };
})();
