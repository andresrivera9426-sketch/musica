// Búsqueda en todo YouTube: 1) YouTube Data API v3 (oficial, con clave de config.js)
// 2) respaldo opcional Piped/Invidious (solo si config.busquedaTerceros === true). 3) enlace a YouTube Music.
const CFG = Object.assign({ youtubeApiKey: '', region: 'CO', busquedaTerceros: false, instanciasPiped: [], instanciasInvidious: [], mantenerPantalla: true }, window.MUSICA_CONFIG || {});
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value };
async function conTiempo(url, ms = 7000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); const j = await r.json().catch(() => null); return { ok: r.ok, status: r.status, j } }
  finally { clearTimeout(t) }
}
async function buscarDataAPI(q) {
  const base = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=25'
    + `&regionCode=${CFG.region}&relevanceLanguage=es&key=${encodeURIComponent(CFG.youtubeApiKey)}&q=${encodeURIComponent(q)}`;
  let r = await conTiempo(base + '&videoCategoryId=10');           // categoría Música
  if (r.ok && !(r.j.items || []).length) r = await conTiempo(base); // si no hay, sin filtro de categoría
  if (!r.ok) throw new Error(r.j?.error?.errors?.[0]?.reason || r.j?.error?.message || ('HTTP ' + r.status));
  return r.j.items.map(it => ({ id: it.id.videoId, titulo: decode(it.snippet.title), artista: decode(it.snippet.channelTitle) }));
}
async function buscarPiped(q) {
  for (const b of CFG.instanciasPiped) {
    try {
      // filter=videos (no music_songs): las pistas automáticas "- Topic" de YouTube Music suelen bloquear la inserción (error 150)
      const r = await conTiempo(`${b}/search?q=${encodeURIComponent(q)}&filter=videos`);
      let items = r.ok ? (r.j.items || []) : [];
      items = items.filter(x => x.type === 'stream' && /v=([\w-]{11})/.test(x.url) && !x.isShort && !(x.duration > 1200))
        .map(x => ({ id: x.url.match(/v=([\w-]{11})/)[1], titulo: x.title, artista: (x.uploaderName || '').replace(/ - Topic$/, '') }));
      if (items.length) return { items, fuente: 'Piped (' + new URL(b).host + ')' };
    } catch (e) { }
  }
  for (const b of CFG.instanciasInvidious) {
    try {
      const r = await conTiempo(`${b}/api/v1/search?q=${encodeURIComponent(q)}&type=video&region=${CFG.region}`);
      const items = (r.ok && Array.isArray(r.j) ? r.j : []).filter(x => x.videoId).map(x => ({ id: x.videoId, titulo: x.title, artista: (x.author || '').replace(/ - Topic$/, '') }));
      if (items.length) return { items, fuente: 'Invidious (' + new URL(b).host + ')' };
    } catch (e) { }
  }
  throw new Error('ninguna instancia respondió');
}
// Devuelve {items, fuente, aviso}
async function buscarEnYouTube(q) {
  let aviso = '';
  if (CFG.youtubeApiKey) {
    try { return { items: await buscarDataAPI(q), fuente: 'YouTube Data API' } }
    catch (e) { aviso = 'La API de YouTube respondió: ' + e.message + (e.message === 'quotaExceeded' ? ' (se acabó el cupo de hoy)' : '') }
  }
  if (CFG.busquedaTerceros) {
    try { const r = await buscarPiped(q); return { ...r, aviso } }
    catch (e) { aviso += (aviso ? ' · ' : '') + 'Respaldo Piped/Invidious: ' + e.message }
  }
  if (!CFG.youtubeApiKey && !CFG.busquedaTerceros) aviso = 'Para buscar en todo YouTube falta poner la clave gratuita de la API de YouTube en config.js.';
  return { items: [], fuente: null, aviso };
}
