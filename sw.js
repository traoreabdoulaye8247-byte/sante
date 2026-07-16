/* Santé — service worker
   Stratégie « réseau d'abord, cache en secours » :
   - avec connexion : tu reçois toujours la dernière version mise en ligne
   - sans connexion : l'app s'ouvre depuis la copie gardée sur le téléphone
   Les données (clients, stock…) restent dans le stockage de Safari,
   ce fichier ne met en cache que l'app elle-même. */
const CACHE = 'sante-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./', './index.html']).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  // Polices et bibliothèques externes : cache d'abord (elles ne changent jamais)
  const externe = !req.url.startsWith(self.location.origin);
  if(externe){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(req, copie)).catch(()=>{});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // L'app elle-même : réseau d'abord, cache si pas de connexion
  e.respondWith(
    fetch(req).then(res => {
      const copie = res.clone();
      caches.open(CACHE).then(c => c.put(req, copie)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
