/* Installed only in the Pages homologation artifact, before game code. */
try {
 ((scope) => {
  'use strict';
  const mount = '/ConsoleGames-Preview/';
  const prefix = 'consolegames-preview:';
  const embedded = scope.location.href === 'about:srcdoc';
  const address = new URL(embedded ? scope.document.baseURI : scope.location.href);
  if (embedded && scope.parent.CONSOLEGAMES_PREVIEW?.mount !== mount) throw new Error('Atividade fora da homologação.');
  const ownsUrl = (url) => {
    const target = new URL(url, address);
    return target.origin === address.origin && target.pathname.startsWith(mount);
  };
  if (!ownsUrl(address)) throw new Error('Endereço da homologação inválido.');

  function namespaceStorage(property) {
    let storage;
    try { storage = scope[property]; } catch { /* Private browsing may deny storage. */ }
    const fallback = new Map();
    const names = () => {
      if (!storage) return [...fallback.keys()];
      const result = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) result.push(key.slice(prefix.length));
      }
      return result;
    };
    const view = {
      get length() { return names().length; },
      key: (index) => names()[index] ?? null,
      getItem: (key) => storage ? storage.getItem(prefix + key) : fallback.get(String(key)) ?? null,
      setItem: (key, value) => storage ? storage.setItem(prefix + key, value) : void fallback.set(String(key), String(value)),
      removeItem: (key) => storage ? storage.removeItem(prefix + key) : void fallback.delete(String(key)),
      clear: () => names().forEach(key => view.removeItem(key)),
    };
    Object.defineProperty(scope, property, {value: new Proxy(view, {
      get: (target, key) => typeof key === 'string' && !(key in target) ? target.getItem(key) ?? undefined : target[key],
      set: (target, key, value) => { target.setItem(key, value); return true; },
      deleteProperty: (target, key) => { target.removeItem(key); return true; },
    })});
  }

  if (scope.document) {
    namespaceStorage('localStorage');
    namespaceStorage('sessionStorage');
    scope.addEventListener('storage', (event) => {
      if (event.key?.startsWith(prefix) && event.isTrusted) {
        event.stopImmediatePropagation();
        scope.dispatchEvent(new StorageEvent('storage', {
          key: event.key.slice(prefix.length), oldValue: event.oldValue, newValue: event.newValue, url: event.url,
        }));
      } else if (event.isTrusted) {
        event.stopImmediatePropagation();
      }
    }, true);
  }

  if (scope.indexedDB) {
    const db = scope.indexedDB;
    for (const operation of ['open', 'deleteDatabase']) {
      const original = db[operation].bind(db);
      db[operation] = (name, ...args) => original(prefix + name, ...args);
    }
    if (db.databases) {
      const databases = db.databases.bind(db);
      db.databases = async () => (await databases()).filter(entry => entry.name?.startsWith(prefix))
        .map(entry => ({...entry, name: entry.name.slice(prefix.length)}));
    }
  }

  if (scope.BroadcastChannel) {
    scope.BroadcastChannel = class extends scope.BroadcastChannel {
      constructor(name) { super(prefix + name); }
    };
  }

  if (scope.caches) {
    const caches = scope.caches;
    const open = caches.open.bind(caches);
    const keys = caches.keys.bind(caches);
    for (const operation of ['open', 'has', 'delete']) {
      const original = caches[operation].bind(caches);
      caches[operation] = (name) => original(prefix + name);
    }
    caches.keys = async () => (await keys()).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
    caches.match = async (request, options = {}) => {
      const names = options.cacheName === undefined ? await caches.keys() : [options.cacheName];
      for (const name of names) {
        if (!await caches.has(name)) continue;
        const entry = await (await open(prefix + name)).match(request, options);
        if (entry) return entry;
      }
      return undefined;
    };
  }

  if (scope.document && scope.navigator.serviceWorker) {
    const workers = scope.navigator.serviceWorker;
    const register = workers.register.bind(workers);
    const getRegistration = workers.getRegistration.bind(workers);
    const getRegistrations = workers.getRegistrations.bind(workers);
    workers.register = async (script, options = {}) => {
      const workerUrl = new URL(script, address);
      const registrationScope = options.scope === undefined ? new URL('./', workerUrl) : options.scope;
      if (!ownsUrl(workerUrl) || !ownsUrl(registrationScope)) throw new Error('Escopo fora da homologação.');
      return register(script, options);
    };
    workers.getRegistration = async (url = address.href) => {
      if (!ownsUrl(url)) return undefined;
      const registration = await getRegistration(url);
      return registration && ownsUrl(registration.scope) ? registration : undefined;
    };
    workers.getRegistrations = async () => (await getRegistrations()).filter(registration => ownsUrl(registration.scope));
  }
  Object.defineProperty(scope, 'CONSOLEGAMES_PREVIEW', {value: Object.freeze({mount, prefix})});
 })(globalThis);
} catch (error) {
  if (typeof document !== 'undefined') {
    document.open();
    document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Homologação do ConsoleGames</title><p>O armazenamento isolado está indisponível neste navegador.</p></html>');
    document.close();
  }
  throw error;
}
