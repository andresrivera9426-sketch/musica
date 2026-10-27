// Música Andrés — reproductor web con embeds oficiales de YouTube (IFrame Player API)
const $ = s => document.querySelector(s);
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
             set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
let DATA = null, player = null, ready = false;
let queue = LS.get('queue', []), qi = LS.get('qi', 0), shuffle = LS.get('shuffle', false);
let favs = LS.get('favs', []), view = 'parati', filtroArtista = null;

const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const artistaDe = x => x.artista && !x.curador ? x.artista : (x.titulo.includes(' - ') ? x.titulo.split(' - ')[0] : (x.canal || x.artista || ''));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const limpio = x => ({ id: x.id, titulo: x.titulo, artista: artistaDe(x), genero: x.genero || '' });
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 1800) }
function seeded(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 }
function dedup(arr) { const v = new Set(); return arr.filter(x => x && x.id && !v.has(x.id) && v.add(x.id)) }

// ---------- datos ----------
async function cargar() {
  const r = await fetch('data/musica.json?' + Date.now());
  DATA = await r.json();
  DATA.todo = dedup([...DATA.novedades, ...DATA.favoritas, ...DATA.tendencias_co, ...DATA.lo_mas_visto_hispano].map(x => ({ ...x, artista: artistaDe(x) })));
  render();
}
function mixDiario() {
  const hoy = new Date().toISOString().slice(0, 10), rnd = seeded(+hoy.replace(/-/g, ''));
  const pesos = Object.fromEntries(DATA.generos.map(g => [g.genero, g.peso]));
  const pool = dedup([...DATA.novedades.filter(x => !x.curador), ...DATA.favoritas]);
  const porGen = {};
  pool.forEach(x => (porGen[x.genero] ||= []).push(x));
  Object.values(porGen).forEach(a => a.sort(() => rnd() - .5));
  const total = Object.values(pesos).reduce((a, b) => a + b, 0), out = [];
  for (let i = 0; i < 40; i++) {
    let r = rnd() * total, g = null;
    for (const [k, w] of Object.entries(pesos)) { if ((r -= w) <= 0) { g = k; break } }
    const a = porGen[g]; if (a && a.length) out.push(a.shift());
  }
  return dedup(out);
}

// ---------- vistas ----------
function card(x, lista, i, badge) {
  const playing = queue[qi]?.id === x.id ? ' playing' : '';
  return `<div class="card${playing}" tabindex="0" data-l="${lista}" data-i="${i}" role="button" aria-label="${esc(x.titulo)}">
    ${badge ? `<span class="badge">${esc(badge)}</span>` : ''}
    <img loading="lazy" src="${thumb(x.id)}" alt="">
    <button class="add" data-add="${lista}:${i}" title="Añadir a la cola" tabindex="-1">＋</button>
    <div class="t">${esc(x.titulo)}</div><div class="a">${esc(artistaDe(x))}</div></div>`;
}
const LISTAS = {};
function fila(titulo, items, sub, opts = {}) {
  if (!items.length) return '';
  const k = 'l' + Object.keys(LISTAS).length; LISTAS[k] = items;
  return `<h2>${esc(titulo)}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}<div class="${opts.grid ? 'grid' : 'row'}">${items.map((x, i) => card(x, k, i, opts.badge?.(x))).join('')}</div>`;
}
function nuevo(x) { if (!x.fecha) return ''; const d = (Date.now() - new Date(x.fecha)) / 864e5; return d <= 14 ? 'NUEVO' : '' }
function render() {
  for (const k in LISTAS) delete LISTAS[k];
  const q = $('#q').value.trim().toLowerCase(); let h = '';
  const act = new Date(DATA.generado).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  if (q) {
    const res = DATA.todo.filter(x => (x.titulo + ' ' + x.artista + ' ' + (x.canal || '')).toLowerCase().includes(q));
    const ytm = `<a class="btn sec" href="https://music.youtube.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">Abrir en YouTube Music ↗</a>`;
    h += `<div class="hero"><div style="flex:1;min-width:220px"><h1>Buscar “${esc(q)}”</h1><p>Pulsa Enter o “Buscar en YouTube” para buscar en todo YouTube</p></div><button class="btn" id="buscaryt">🔎 Buscar en YouTube</button>${ytm}</div>`;
    if (REMOTO.q === q) {
      if (REMOTO.cargando) h += '<h2>Buscando en YouTube…</h2>';
      else {
        h += fila(`En YouTube`, REMOTO.items, `${REMOTO.items.length} resultados · fuente: ${esc(REMOTO.fuente || '—')}${REMOTO.aviso ? ' · ' + esc(REMOTO.aviso) : ''}`, { grid: true })
          || `<h2>Sin resultados de YouTube</h2><p class="muted">${esc(REMOTO.aviso || 'No hubo resultados.')}</p>`;
      }
    }
    h += fila(`En tu catálogo de hoy`, res, `${res.length} coincidencias`, { grid: true });
  } else if (view === 'parati') {
    const mix = mixDiario(); LISTAS.mix = mix;
    h += `<div class="hero"><div style="flex:1;min-width:220px"><h1>Tu mezcla de hoy</h1><p>${mix.length} canciones según lo que escuchas · cambia cada día · actualizado ${esc(act)}</p></div>
      <button class="btn" data-playall="mix">▶ Reproducir</button><button class="btn sec" data-shuffleall="mix">🔀 Aleatorio</button></div>`;
    h += `<h2>Tus artistas</h2><div class="chips">${DATA.artistas.filter(a => a.reproducciones > 0).slice(0, 24).map(a => `<button class="chip${filtroArtista === a.nombre ? ' on' : ''}" data-art="${esc(a.nombre)}">${esc(a.nombre)}</button>`).join('')}</div>`;
    if (filtroArtista) {
      const its = DATA.todo.filter(x => x.artista === filtroArtista || (x.titulo + (x.canal || '')).toLowerCase().includes(filtroArtista.toLowerCase()));
      h += fila(filtroArtista, its, its.length ? '' : 'Sin canciones de este artista en el catálogo de hoy', { grid: true }) || `<p class="muted">Sin canciones de ${esc(filtroArtista)} en el catálogo de hoy. <a target="_blank" rel="noopener" href="https://music.youtube.com/search?q=${encodeURIComponent(filtroArtista)}">Abrir en YouTube Music ↗</a></p>`;
    }
    h += fila('Recién salido de tus artistas', DATA.novedades.filter(x => !x.curador).slice(0, 24), 'Lo más reciente publicado por los artistas que más escuchas', { badge: nuevo });
    for (const g of DATA.generos) {
      const its = dedup([...DATA.novedades.filter(x => x.genero === g.genero && !x.curador), ...DATA.favoritas.filter(x => x.genero === g.genero)]);
      h += fila(g.genero, its.slice(0, 24), '', { badge: nuevo });
    }
    h += fila('Descubre (curadores que sigues)', DATA.novedades.filter(x => x.curador).slice(0, 24), 'Canales que recopilan música nueva de tus estilos', { badge: nuevo });
    h += fila('Tus más repetidas', DATA.favoritas.slice(0, 30), 'Según tu historial de YouTube Music');
  } else if (view === 'novedades') {
    h += fila('Novedades de tus artistas', DATA.novedades.filter(x => !x.curador), `Últimos ${120} días, de la más nueva a la más antigua · actualizado ${esc(act)}`, { grid: true, badge: x => nuevo(x) || x.fecha });
  } else if (view === 'tendencias') {
    h += fila('En tendencia en Colombia', DATA.tendencias_co, 'Videos musicales en tendencia en YouTube Colombia (fuente: kworb.net)', { badge: x => '#' + x.pos });
    h += fila('Lo más visto hoy en español', DATA.lo_mas_visto_hispano, 'Videos musicales en español más vistos en las últimas 24 h (kworb.net)', { badge: x => '#' + x.pos });
    const ch = DATA.chart_semanal_co;
    h += `<h2>Top semanal YouTube Colombia</h2><p class="sub">Chart oficial semanal de YouTube para Colombia (vía kworb.net). Las que no tienen video enlazado abren en YouTube Music.</p><div class="list">` +
      ch.map(c => c.id ? `<button class="li" data-chart="${c.id}" data-t="${esc(c.titulo)}"><span class="n">${c.pos}</span><img loading="lazy" src="${thumb(c.id)}" alt=""><span>${esc(c.titulo)}</span><span class="muted">▶</span></button>`
        : `<a class="li" target="_blank" rel="noopener" href="https://music.youtube.com/search?q=${encodeURIComponent(c.titulo)}"><span class="n">${c.pos}</span><span></span><span>${esc(c.titulo)}</span><span class="muted">↗</span></a>`).join('') + '</div>';
  } else if (view === 'favoritos') {
    h += fila('Tus favoritos', favs, 'Guardados en este navegador', { grid: true }) || '<h2>Tus favoritos</h2><p class="muted">Aún no tienes favoritos. Pulsa ♡ mientras suena una canción.</p>';
  } else if (view === 'cola') {
    h += `<h2>Cola de reproducción</h2>${queue.length ? `<p class="sub">${queue.length} canciones · <button class="chip" id="vaciar">Vaciar</button></p>` : '<p class="muted">La cola está vacía.</p>'}<div class="list">` +
      queue.map((x, i) => `<div class="li${i === qi ? ' cur' : ''}" tabindex="0" data-qi="${i}"><span class="n">${i === qi ? '▶' : i + 1}</span><img loading="lazy" src="${thumb(x.id)}" alt=""><span>${esc(x.titulo)}<br><small class="muted">${esc(x.artista)}</small></span><button class="x" data-del="${i}" title="Quitar">✕</button></div>`).join('') + '</div>';
  }
  $('#view').innerHTML = h;
  $('#qcount').textContent = queue.length ? `(${queue.length})` : '';
}

// ---------- reproductor ----------
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('yt', { playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
    events: { onReady: () => { ready = true; player.setVolume(+$('#vol').value); if (queue[qi]) { player.cueVideoById(queue[qi].id); meta() } },
      onStateChange: e => { $('#play').textContent = e.data === 1 ? '⏸' : '▶'; pantalla(e.data === 1); if (e.data === 0) siguiente(); if (e.data === 1) $('#ph').style.display = 'none' },
      onError: e => { toast('Este video no se puede reproducir aquí; paso al siguiente'); setTimeout(siguiente, 800) } } });
};
function guardar() { LS.set('queue', queue); LS.set('qi', qi) }
function meta() {
  const x = queue[qi]; if (!x) return;
  $('#btitle').textContent = $('#nt').textContent = x.titulo; $('#bartist').textContent = $('#na').textContent = x.artista;
  $('#bthumb').src = thumb(x.id); $('#fav').classList.toggle('on', favs.some(f => f.id === x.id)); $('#fav').textContent = favs.some(f => f.id === x.id) ? '♥' : '♡';
  document.title = x.titulo + ' · Música Andrés';
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: x.titulo, artist: x.artista, artwork: [{ src: `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg`, sizes: '480x360' }] });
}
function tocar(i) {
  if (!queue.length) return; document.body.classList.add('activo'); qi = (i + queue.length) % queue.length; guardar(); meta();
  if (ready) player.loadVideoById(queue[qi].id); $('#ph').style.display = 'none';
  document.querySelectorAll('.card.playing').forEach(c => c.classList.remove('playing'));
  if (view === 'cola') render();
}
function siguiente() { if (shuffle && queue.length > 1) { let j; do j = Math.floor(Math.random() * queue.length); while (j === qi); tocar(j) } else tocar(qi + 1) }
function anterior() { if (ready && player.getCurrentTime() > 4) player.seekTo(0, true); else tocar(qi - 1) }
function playLista(items, i = 0, mezclar = false) {
  queue = items.map(limpio); if (mezclar) queue.sort(() => Math.random() - .5); tocar(mezclar ? 0 : i);
}
function alternar() { if (!ready || !queue[qi]) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo() }
function toggleFav() {
  const x = queue[qi]; if (!x) return; const k = favs.findIndex(f => f.id === x.id);
  k >= 0 ? favs.splice(k, 1) : favs.unshift(x); LS.set('favs', favs); meta(); toast(k >= 0 ? 'Quitado de favoritos' : 'Guardado en favoritos'); if (view === 'favoritos') render();
}
setInterval(() => {
  if (!ready || !player.getDuration) return; const d = player.getDuration() || 0, c = player.getCurrentTime() || 0;
  const f = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  $('#tcur').textContent = f(c); $('#tdur').textContent = f(d); if (!$('#seek')._drag) $('#seek').value = d ? c / d * 1000 : 0;
}, 500);

// ---------- eventos ----------
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; $('#q').value = '';
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); window.scrollTo(0, 0) };
const REMOTO = { q: null, items: [], cargando: false };
async function buscarRemoto() {
  const q = $('#q').value.trim().toLowerCase(); if (q.length < 2) return;
  Object.assign(REMOTO, { q, items: [], cargando: true, aviso: '', fuente: null }); render();
  try { Object.assign(REMOTO, await buscarEnYouTube(q)) } catch (e) { REMOTO.aviso = String(e) }
  if (REMOTO.q === q) { REMOTO.cargando = false; render(); document.querySelector('#view h2')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
}
$('#q').oninput = () => render();
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarRemoto() } });
$('#play').onclick = alternar; $('#next').onclick = siguiente; $('#prev').onclick = anterior; $('#fav').onclick = toggleFav;
$('#shuf').onclick = () => { shuffle = !shuffle; LS.set('shuffle', shuffle); $('#shuf').classList.toggle('on', shuffle); toast(shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado') };
$('#shuf').classList.toggle('on', shuffle);
$('#seek').oninput = () => $('#seek')._drag = true;
$('#seek').onchange = () => { $('#seek')._drag = false; if (ready) player.seekTo(player.getDuration() * $('#seek').value / 1000, true) };
$('#vol').oninput = () => ready && player.setVolume(+$('#vol').value);
$('#view').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.add) { const [l, i] = t.dataset.add.split(':'); queue.push(limpio(LISTAS[l][+i])); guardar(); render(); toast('Añadido a la cola'); e.stopPropagation(); return }
  if (t.dataset.playall) return playLista(LISTAS[t.dataset.playall]);
  if (t.dataset.shuffleall) return playLista(LISTAS[t.dataset.shuffleall], 0, true);
  if (t.dataset.art) { filtroArtista = filtroArtista === t.dataset.art ? null : t.dataset.art; return render() }
  if (t.dataset.del) { const i = +t.dataset.del; queue.splice(i, 1); if (i < qi) qi--; guardar(); return render() }
  if (t.id === 'buscaryt') return buscarRemoto();
  if (t.id === 'vaciar') { queue = []; qi = 0; guardar(); return render() }
  const ch = t.closest('[data-chart]'); if (ch) { const its = DATA.chart_semanal_co.filter(c => c.id).map(c => ({ id: c.id, titulo: c.titulo })); return playLista(its, its.findIndex(c => c.id === ch.dataset.chart)) }
  const q = t.closest('[data-qi]'); if (q) return tocar(+q.dataset.qi);
  const c = t.closest('.card'); if (c) playLista(LISTAS[c.dataset.l], +c.dataset.i);
});
// Teclado / control remoto de TV: flechas para moverse, Enter para tocar, espacio, N, P, F
document.addEventListener('keydown', e => {
  const enInput = e.target.tagName === 'INPUT' && e.target.type !== 'range';
  if (e.key === 'Enter' && e.target.matches('.card,[data-qi]')) { e.target.click(); return }
  if (enInput && e.key !== 'ArrowDown') return;
  if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); alternar() }
  else if (e.key === 'n' || e.key === 'MediaTrackNext') siguiente();
  else if (e.key === 'p' || e.key === 'MediaTrackPrevious') anterior();
  else if (e.key === 'f') toggleFav();
  else if (e.key === 'MediaPlayPause') alternar();
  else if (e.key.startsWith('Arrow') && e.target.type !== 'range') { e.preventDefault(); mover(e.key) }
});
function mover(k) {
  const els = [...document.querySelectorAll('nav button,#q,.card,.chip,.btn,.li,#bar button')].filter(x => x.offsetParent);
  const cur = document.activeElement; if (!els.includes(cur)) return els.find(x => x.matches('.card'))?.focus();
  const a = cur.getBoundingClientRect(), cx = a.left + a.width / 2, cy = a.top + a.height / 2; let best = null, bd = 1e9;
  for (const el of els) { if (el === cur) continue; const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, dx = x - cx, dy = y - cy;
    const ok = k === 'ArrowRight' ? dx > 5 : k === 'ArrowLeft' ? dx < -5 : k === 'ArrowDown' ? dy > 5 : dy < -5; if (!ok) continue;
    const d = (k === 'ArrowRight' || k === 'ArrowLeft') ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 2; if (d < bd) { bd = d; best = el } }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }) }
}
if ('mediaSession' in navigator) { navigator.mediaSession.setActionHandler('nexttrack', siguiente); navigator.mediaSession.setActionHandler('previoustrack', anterior) }
cargar().catch(e => $('#view').innerHTML = '<p>No se pudo cargar data/musica.json: ' + esc(e) + '</p>');

// ---------- pantalla encendida (Screen Wake Lock API) y "seguir en YouTube Music" ----------
// Las políticas de YouTube (YouTube API Services, I.9) prohíben reproducir desde un reproductor que no se ve
// (segundo plano / pantalla apagada). Lo legal: mantener la pantalla encendida mientras suena, o pasar a la app oficial.
let wake = null, wakeOn = LS.get('wake', (window.MUSICA_CONFIG || {}).mantenerPantalla !== false);
async function pantalla(sonando) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (sonando && wakeOn && document.visibilityState === 'visible' && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; marcarWake() }) }
    if ((!sonando || !wakeOn) && wake) { await wake.release(); wake = null }
  } catch (e) { wake = null }
  marcarWake();
}
function marcarWake() { const b = $('#wake'); if (!b) return; b.classList.toggle('on', wakeOn); b.title = 'Mantener pantalla encendida: ' + (wakeOn ? 'sí' : 'no') + (wake ? ' (activo)' : ''); b.dataset.activo = wake ? '1' : '0' }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready) pantalla(player.getPlayerState() === 1) });
$('#wake').onclick = () => { wakeOn = !wakeOn; LS.set('wake', wakeOn); pantalla(ready && player.getPlayerState() === 1); toast(wakeOn ? 'La pantalla se mantendrá encendida mientras suena' : 'La pantalla podrá apagarse (la música se detendrá)') };
$('#ytm').onclick = () => {
  const x = queue[qi]; if (!x) return toast('Primero elige una canción');
  const t = ready ? Math.floor(player.getCurrentTime() || 0) : 0; if (ready) player.pauseVideo();
  window.open(`https://music.youtube.com/watch?v=${x.id}${t > 5 ? '&t=' + t : ''}`, '_blank', 'noopener');
};
marcarWake();
