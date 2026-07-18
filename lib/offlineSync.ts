export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CrickpulseOfflineDB', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('matchQueue')) {
        db.createObjectStore('matchQueue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

export const saveToOfflineQueue = async (matchId: string, payload: unknown) => {
  try {
    const db = await initDB();
    const transaction = db.transaction('matchQueue', 'readwrite');
    const store = transaction.objectStore('matchQueue');
    store.add({ matchId, payload, timestamp: Date.now() });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Failed to save to offline queue", error);
  }
};

export const getOfflineQueue = async (): Promise<unknown[]> => {
  try {
    const db = await initDB();
    const transaction = db.transaction('matchQueue', 'readonly');
    const store = transaction.objectStore('matchQueue');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get offline queue", error);
    return [];
  }
};

export const clearOfflineQueue = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction('matchQueue', 'readwrite');
    const store = transaction.objectStore('matchQueue');
    store.clear();
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Failed to clear offline queue", error);
  }
};
