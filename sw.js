/* Santé — service worker (hors ligne)
   « Réseau d'abord, cache en secours » :
   - avec connexion : tu reçois toujours la dernière version mise en ligne
   - sans connexion : l'app s'ouvre depuis la copie gardée dans le téléphone
   Ce fichier ne met en cache QUE l'app. Tes données (clients, stock,
   bénédictions) vivent ailleurs et ne sont jamais touchées ici. */
const CACHE = 'sante-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all([
        c.add('./index.html').catch(()=>{}),
        c.add('./').catch(()=>{})
      ]))
      .catch(()=>{})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
      .catch(()=>{})
  );
});

/* Dernier recours : ne JAMAIS renvoyer du vide (c'était une cause possible de page blanche) */
function pageDeSecours(){
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;background:#0F1730;color:#F6F1E4;font-family:-apple-system,sans-serif;' +
    'display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;">' +
    '<div><div style="font-size:44px;">💧</div><h2>Santé</h2>' +
    '<p style="opacity:.75;line-height:1.5;">Pas de connexion et aucune copie disponible.<br>' +
    'Reconnecte-toi une fois : l\'app se gardera ensuite dans le téléphone.</p>' +
    '<p style="opacity:.6;font-size:13px;">Tes données ne sont pas perdues, elles restent dans ce téléphone.</p>' +
    '</div></body>',
    {headers:{'Content-Type':'text/html; charset=utf-8'}}
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const externe = !req.url.startsWith(self.location.origin);
  if(externe){
    e.respondWith(
      caches.match(req).then(hit =>
        hit || fetch(req).then(res => {
          const copie = res.clone();
          caches.open(CACHE).then(c => c.put(req, copie)).catch(()=>{});
          return res;
        }).catch(() => hit || Response.error())
      ).catch(() => Response.error())
    );
    return;
  }

  e.respondWith(
    fetch(req).then(res => {
      const copie = res.clone();
      caches.open(CACHE).then(c => c.put(req, copie)).catch(()=>{});
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if(hit) return hit;
      const accueil = await caches.match('./index.html');
      if(accueil) return accueil;
      if(req.mode === 'navigate') return pageDeSecours();
      return Response.error();
    })
  );
});
