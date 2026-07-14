(function(){
  "use strict";

  var DB_NAME = "salesOS";
  var DB_VERSION = 1;
  var TABLES = ["jobs", "prospects", "calls", "interested_leads", "closed_deals"];
  var META_STORE = "meta";
  var QUEUE_STORE = "write_queue";
  var dbPromise = null;

  function promisifyRequest(req){
    return new Promise(function(resolve, reject){
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error || new Error("IndexedDB request failed")); };
    });
  }

  function openDatabase(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(ev){
        var db = ev.target.result;
        TABLES.forEach(function(table){
          if(!db.objectStoreNames.contains(table)){
            db.createObjectStore(table, { keyPath: "id" });
          }
        });
        if(!db.objectStoreNames.contains(META_STORE)){
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
        if(!db.objectStoreNames.contains(QUEUE_STORE)){
          var q = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
          q.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error || new Error("IndexedDB open failed")); };
    });
    return dbPromise;
  }

  function normalizeId(id){
    if(id == null || id === "") return "";
    return String(id);
  }

  function rowId(row){
    if(!row || row.id == null || row.id === "") return "";
    return normalizeId(row.id);
  }

  async function withStore(storeName, mode, fn){
    var db = await openDatabase();
    return new Promise(function(resolve, reject){
      var tx = db.transaction(storeName, mode);
      var store = tx.objectStore(storeName);
      var out;
      try{
        out = fn(store, tx);
      }catch(err){
        reject(err);
        return;
      }
      tx.oncomplete = function(){ resolve(out); };
      tx.onerror = function(){ reject(tx.error || new Error("IndexedDB transaction failed")); };
      tx.onabort = function(){ reject(tx.error || new Error("IndexedDB transaction aborted")); };
    });
  }

  async function init(){
    await openDatabase();
    return true;
  }

  async function getAll(table){
    if(TABLES.indexOf(table) < 0) return [];
    return withStore(table, "readonly", function(store){
      return promisifyRequest(store.getAll());
    });
  }

  async function getJobsMap(){
    var rows = await getAll("jobs");
    var out = Object.create(null);
    rows.forEach(function(r){
      if(r && r.id != null) out[normalizeId(r.id)] = r;
    });
    return out;
  }

  async function putRows(table, rows){
    if(TABLES.indexOf(table) < 0) return;
    var list = Array.isArray(rows) ? rows : [];
    await withStore(table, "readwrite", function(store){
      list.forEach(function(row){
        var id = rowId(row);
        if(!id) return;
        var copy = Object.assign({}, row, { id: id });
        store.put(copy);
      });
    });
  }

  async function putRow(table, row){
    if(!row) return;
    return putRows(table, [row]);
  }

  async function deleteRow(table, id){
    if(TABLES.indexOf(table) < 0) return;
    var key = normalizeId(id);
    if(!key) return;
    await withStore(table, "readwrite", function(store){
      store.delete(key);
    });
  }

  async function replaceTable(table, rows){
    if(TABLES.indexOf(table) < 0) return;
    var list = Array.isArray(rows) ? rows : [];
    await withStore(table, "readwrite", function(store){
      store.clear();
      list.forEach(function(row){
        var id = rowId(row);
        if(!id) return;
        store.put(Object.assign({}, row, { id: id }));
      });
    });
  }

  async function getMeta(key){
    var row = await withStore(META_STORE, "readonly", function(store){
      return promisifyRequest(store.get(String(key)));
    });
    return row ? row.value : null;
  }

  async function setMeta(key, value){
    await withStore(META_STORE, "readwrite", function(store){
      store.put({ key: String(key), value: value });
    });
  }

  async function persistFromMemory(lsKey, value){
    if(lsKey === "jobs"){
      var map = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      var rows = Object.keys(map).map(function(k){ return map[k]; }).filter(Boolean);
      await replaceTable("jobs", rows);
      return;
    }
    if(TABLES.indexOf(lsKey) >= 0){
      await replaceTable(lsKey, Array.isArray(value) ? value : []);
    }
  }

  async function enqueueWrite(entry){
    var item = Object.assign({
      createdAt: new Date().toISOString(),
      retries: 0
    }, entry || {});
    return withStore(QUEUE_STORE, "readwrite", function(store){
      return promisifyRequest(store.add(item));
    });
  }

  async function getWriteQueue(){
    var rows = await withStore(QUEUE_STORE, "readonly", function(store){
      return promisifyRequest(store.getAll());
    });
    rows.sort(function(a, b){
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
    return rows;
  }

  async function dequeueWrite(id){
    if(id == null) return;
    await withStore(QUEUE_STORE, "readwrite", function(store){
      store.delete(id);
    });
  }

  async function patchRows(table, rows){
    if(!rows || !rows.length) return;
    await putRows(table, rows);
  }

  window.LOCAL_STORE = {
    DB_NAME: DB_NAME,
    TABLES: TABLES.slice(),
    init: init,
    getAll: getAll,
    getJobsMap: getJobsMap,
    putRows: putRows,
    putRow: putRow,
    patchRows: patchRows,
    deleteRow: deleteRow,
    replaceTable: replaceTable,
    getMeta: getMeta,
    setMeta: setMeta,
    persistFromMemory: persistFromMemory,
    enqueueWrite: enqueueWrite,
    getWriteQueue: getWriteQueue,
    dequeueWrite: dequeueWrite
  };
})();
