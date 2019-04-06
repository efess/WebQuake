const dbName = 'webQuakeAssets',
  metaStoreName = 'meta',
  assetStoreName = 'assets',
  dbVersion = 4;

const indexedDb: IDBFactory = window.indexedDB

function open (): Promise<IDBDatabase> {
  return new Promise(function(resolve, reject){
    var openReq: IDBOpenDBRequest = indexedDb.open(dbName, dbVersion);
    openReq.onupgradeneeded = function(event: any) {
      var db = event.target.result as IDBDatabase;
      db.createObjectStore("meta", { autoIncrement: true });
      db.createObjectStore("assets", { keyPath: 'assetId' });
    };
    openReq.onerror = function(event) {
      alert("Why didn't you allow my web app to use IndexedDB?!");
      reject()
    };
    openReq.onsuccess = function(event: any){
      resolve(event.target.result);
    };
  });
}

const dbOperation = async (storeName: string, fn: (db: IDBObjectStore) => IDBRequest): Promise<any> => {
  const db = await open()
  const store = db
    .transaction([storeName], 'readwrite')
    .objectStore(storeName); 

  return new Promise((resolve, reject) =>  {
    const request = fn(store) as IDBRequest;
      
    request.onerror = function(e) {
      console.log(e);
      reject(e);
    };
    request.onsuccess = function(event) {
      resolve(request.result as any);
    };
  })
}

export const getAllMeta = async (): Promise<Array<any>> => {
  const keys = await dbOperation(metaStoreName, store => store.getAllKeys())
  return Promise.all(keys.map(async key => {
    const meta = await dbOperation(metaStoreName, store => store.get(key))

    return {
      ...meta,
      assetId: key
    }
  }))
}

export const getAllMetaPerGame = async (game): Promise<Array<any>> => {
  const assetMetas = await getAllMeta()
  return assetMetas.filter(meta => meta.game === game)
}

export const getAllAssets = async () => {
  return dbOperation(assetStoreName, store => store.getAll())
}

export const getAllAssetsPerGame = async (game) => {
  const assetMetas = await getAllMetaPerGame(game)
  
  return Promise.all(assetMetas.map(async assetMeta => {
    const asset = await dbOperation(assetStoreName, store => store.get(assetMeta.assetId))
    return {
      ...assetMeta,
      ...asset
    }
  }))
}

export const saveAsset = async (game: string, fileName: string, fileCount: number, blob: any) => {
  if (!game || !fileName || fileCount <= 0) {
    throw new Error('Missing data while trying to save asset')
  }
  const metaObj = {
    game,
    fileName,
    fileCount
  }
  const assetId = await dbOperation(metaStoreName, store => store.put(metaObj))
  await dbOperation(assetStoreName, store => store.put({data: blob, assetId}))
  return assetId
}

export const removeAsset = async (assetId): Promise<void> => {
  await dbOperation(metaStoreName, store => store.delete(assetId))
  return await dbOperation(assetStoreName, store => store.delete(assetId))
}
