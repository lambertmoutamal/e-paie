// Service de l'application « DématPaie Salarié » (espace salarié uniquement).
// Confidentialité : AUCUNE page ni AUCUN bulletin n'est gardé sur le téléphone. Sans réseau,
// une simple page explique qu'il faut une connexion Internet.
const PAGE_HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DématPaie</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6f7fb;color:#1b1e2e;text-align:center;padding:24px}
.carte{max-width:360px}.logo{width:56px;height:56px;border-radius:14px;background:#4f46e5;margin:0 auto 16px}h1{font-size:20px;margin:0 0 8px}p{color:#5b6478;line-height:1.5}
button{margin-top:16px;height:44px;padding:0 20px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-size:15px;font-weight:600}</style></head>
<body><div class="carte"><div class="logo"></div><h1>Pas de connexion Internet</h1><p>Vos bulletins sont consultés en ligne pour rester protégés. Vérifiez votre connexion puis réessayez.</p>
<button onclick="location.reload()">Réessayer</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evenement) => evenement.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (evenement) => {
  if (evenement.request.mode !== "navigate") return; // fichiers, images… : comportement normal
  evenement.respondWith(
    fetch(evenement.request).catch(() => new Response(PAGE_HORS_LIGNE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
  );
});
