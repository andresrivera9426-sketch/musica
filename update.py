#!/usr/bin/env python3
"""Genera data/musica.json para la web de música de Andres. Sin claves de API.
Fuentes:
  1) Novedades de sus artistas: RSS público de YouTube
     (https://www.youtube.com/feeds/videos.xml?channel_id=...). Si el RSS falla
     (en oct-2026 devuelve 404 de forma intermitente/permanente), respaldo: lectura
     de la página pública /videos del canal (datos ytInitialData). Ese respaldo es
     frágil (YouTube puede cambiarla) y no es una API oficial.
  2) Tendencias Colombia: kworb.net/youtube/trending/co.html (videos en tendencia CO,
     filtrados a música) y kworb.net/youtube/insights/co.html (chart semanal CO, solo títulos;
     se enlaza al video si aparece en kworb realtime_hispano).
  3) Lo más visto hoy en español: kworb.net/youtube/realtime_hispano.html
  4) Validación: cada video se comprueba con oEmbed (https://www.youtube.com/oembed);
     se descartan los inexistentes o con inserción desactivada.
Uso: python3 update.py   (programarlo 1 vez al día con cron)"""
import json, re, os, sys, time, html, urllib.request, urllib.error, concurrent.futures as cf
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

DIR = os.path.dirname(os.path.abspath(__file__))
PERFIL = json.load(open(os.path.join(DIR, 'data', 'perfil.json')))
OUT = os.path.join(DIR, 'data', 'musica.json')
BOG = timezone(timedelta(hours=-5))
NOW = datetime.now(timezone.utc)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.8"}
DIAS_NOVEDAD = 120     # ventana de "novedades" de artistas
LOG = []

def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')

NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015",
      "media": "http://search.yahoo.com/mrss/"}

def via_rss(cid):
    for url in (f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}",
                f"https://www.youtube.com/feeds/videos.xml?playlist_id=UU{cid[2:]}"):
        try:
            root = ET.fromstring(get(url))
        except Exception:
            continue
        out = []
        for e in root.findall("a:entry", NS):
            link = e.find("a:link", NS).get("href", "")
            if "/shorts/" in link: continue
            st = e.find("media:group/media:community/media:statistics", NS)
            out.append({"id": e.find("yt:videoId", NS).text, "titulo": e.find("a:title", NS).text,
                        "fecha": e.find("a:published", NS).text[:10],
                        "vistas": int(st.get("views", 0)) if st is not None else None})
        return out
    return None

REL = {"second": 0, "minute": 0, "hour": 0, "day": 1, "week": 7, "month": 30, "year": 365}
ES = [("seg", 0), ("min", 0), ("hora", 0), ("d", 1), ("sem", 7), ("mes", 30), ("a", 365)]
def rel_dias(t):
    t = (t or '').lower()
    m = re.search(r'(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago', t)
    if m: return int(m.group(1)) * REL[m.group(2)]
    m = re.search(r'(\d+)\s*(s|min|h|d|w|mo|y)\s+ago', t)
    if m: return int(m.group(1)) * {"s": 0, "min": 0, "h": 0, "d": 1, "w": 7, "mo": 30, "y": 365}[m.group(2)]
    m = re.search(r'hace\s+(\d+)\s+(\w+)', t)
    if m:
        for pref, k in ES:
            if m.group(2).startswith(pref): return int(m.group(1)) * k
    return None

def dur_seg(t):
    p = [int(x) for x in re.findall(r'\d+', t or '')] if re.fullmatch(r'[\d:]+', t or '') else []
    s = 0
    for x in p: s = s * 60 + x
    return s or None

def via_pagina(cid):
    s = get(f"https://www.youtube.com/channel/{cid}/videos?hl=en&gl=CO")
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', s, re.S)
    if not m: return None
    data = json.loads(m.group(1)); out = []
    def walk(o):
        if isinstance(o, dict):
            if 'lockupViewModel' in o:
                v = o['lockupViewModel']
                if v.get('contentType') == 'LOCKUP_CONTENT_TYPE_VIDEO':
                    j = json.dumps(v)
                    tit = v['metadata']['lockupMetadataViewModel']['title']['content']
                    rows = v['metadata']['lockupMetadataViewModel'].get('metadata', {}).get('contentMetadataViewModel', {}).get('metadataRows', [])
                    textos = [p.get('text', {}).get('content', '') for r in rows for p in r.get('metadataParts', [])]
                    dias = next((rel_dias(t) for t in textos if rel_dias(t) is not None), None)
                    if any('Streamed' in t or 'watching' in t for t in textos): return
                    dur = next((dur_seg(b) for b in re.findall(r'"text": "([\d:]+)"', j)), None)
                    out.append({"id": v['contentId'], "titulo": tit, "dias": dias, "dur": dur,
                                "fecha": (NOW - timedelta(days=dias)).astimezone(BOG).strftime('%Y-%m-%d') if dias is not None else None,
                                "fecha_aprox": True})
                return
            if 'videoRenderer' in o:
                v = o['videoRenderer']
                t = v.get('publishedTimeText', {}).get('simpleText', '')
                dias = rel_dias(t)
                out.append({"id": v['videoId'], "titulo": ''.join(r.get('text', '') for r in v['title'].get('runs', [])),
                            "dias": dias, "dur": dur_seg(v.get('lengthText', {}).get('simpleText')),
                            "fecha": (NOW - timedelta(days=dias)).astimezone(BOG).strftime('%Y-%m-%d') if dias is not None else None,
                            "fecha_aprox": True})
                return
            for x in o.values(): walk(x)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(data)
    return out

def novedades_canal(nombre, genero, cid, curador=False):
    items, fuente = None, None
    for intento in range(2):
        items = via_rss(cid)
        if items is not None: fuente = 'rss'; break
    if items is None:
        for intento in range(3):
            try:
                items = via_pagina(cid); fuente = 'pagina'
                if items is not None: break
            except Exception as e:
                time.sleep(1.5)
    if not items:
        LOG.append(f"sin datos: {nombre} ({cid})"); return []
    res = []
    for it in items[:15]:
        if re.search(r'trailer|teaser|#shorts', it['titulo'], re.I): continue
        if it.get('dur') and (it['dur'] < 70 or it['dur'] > 15 * 60): continue  # fuera shorts/directos/compilados
        if not it.get('fecha'): continue  # sin fecha no se puede saber si es novedad
        if it.get('fecha'):
            d = (NOW.date() - datetime.strptime(it['fecha'], '%Y-%m-%d').date()).days
            if d > DIAS_NOVEDAD: continue
        it.update({"artista": nombre, "genero": genero, "fuente": fuente, "curador": curador})
        res.append(it)
    return res

def kworb_trending_co():
    s = get("https://kworb.net/youtube/trending/co.html"); out = []
    for pos, vid, tit in re.findall(r'<tr[^>]*><td>(\d+)</td><td>[^<]*</td><td class="text"><div><a href="https://youtu\.be/([A-Za-z0-9_-]{11})"[^>]*>(.*?)</a>', s):
        tit = html.unescape(tit)
        if re.search(r'trailer|teaser|gameplay|minecraft|roblox|spoiler', tit, re.I): continue
        if re.search(r' - |official|oficial|video|letra|lyric|visualizer|audio', tit, re.I):
            out.append({"id": vid, "titulo": tit, "pos": int(pos)})
    return out

def kworb_hispano():
    s = get("https://kworb.net/youtube/realtime_hispano.html")
    return [{"id": v, "titulo": html.unescape(t), "pos": i + 1}
            for i, (v, t) in enumerate(re.findall(r'<a href="video/([A-Za-z0-9_-]{11})\.html">(.*?)</a>', s))]

def kworb_semanal_co():
    s = get("https://kworb.net/youtube/insights/co.html")
    return [html.unescape(t) for t in re.findall(r'<td class="text mp"><div>(.*?)</div>', s)]

def oembed(vid):
    try:
        j = json.loads(get(f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json", 15))
        return vid, {"ok": True, "canal": j.get("author_name"), "titulo": j.get("title")}
    except urllib.error.HTTPError as e:
        return vid, {"ok": False, "code": e.code}
    except Exception as e:
        return vid, {"ok": None, "err": str(e)[:80]}

def norm(t): return re.sub(r'[^a-z0-9]', '', re.sub(r'\(.*?\)|\[.*?\]', '', t.lower()))

def main():
    t0 = time.time()
    tareas = [(a['nombre'], a['genero'], a['canal'], False) for a in PERFIL['artistas']]
    tareas += [(c['nombre'], c['genero'], c['canal'], True) for c in PERFIL['curadores']]
    novedades = []
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(lambda t: novedades_canal(*t), tareas): novedades += r
    fuentes = {}
    for n in novedades: fuentes[n['fuente']] = fuentes.get(n['fuente'], 0) + 1
    try: trending = kworb_trending_co()
    except Exception as e: trending = []; LOG.append(f"kworb trending CO falló: {e}")
    try: hispano = kworb_hispano()
    except Exception as e: hispano = []; LOG.append(f"kworb hispano falló: {e}")
    try: semanal = kworb_semanal_co()
    except Exception as e: semanal = []; LOG.append(f"kworb semanal CO falló: {e}")
    idx = {norm(h['titulo'].split(' - ', 1)[-1]) + '|' + norm(h['titulo'].split(' - ')[0][:12]): h for h in hispano}
    chart_co = []
    for i, t in enumerate(semanal[:50]):
        art, _, can = t.partition(' - ')
        m = next((h for h in hispano if norm(can) and norm(can) in norm(h['titulo']) and norm(art.split(',')[0].split('&')[0])[:6] in norm(h['titulo'])), None)
        chart_co.append({"pos": i + 1, "titulo": t, "id": m['id'] if m else None})
    favs = PERFIL['favoritas']
    ids = {x['id'] for x in novedades + trending + hispano + favs} | {c['id'] for c in chart_co if c['id']}
    with cf.ThreadPoolExecutor(16) as ex:
        ver = dict(ex.map(oembed, ids))
    def ok(x):
        v = ver.get(x['id'], {})
        if v.get('ok'):
            x['canal'] = v['canal']; return True
        return False
    descartados = sum(1 for v in ver.values() if v.get('ok') is False)
    novedades = sorted([x for x in novedades if ok(x)], key=lambda x: x.get('fecha') or '', reverse=True)
    vistos = set(); nov2 = []
    for x in novedades:
        if x['id'] not in vistos: vistos.add(x['id']); nov2.append(x)
    salida = {
      "generado": datetime.now(BOG).isoformat(timespec='minutes'),
      "generos": PERFIL['generos'],
      "artistas": [{k: a[k] for k in ('nombre', 'genero', 'reproducciones', 'canal')} for a in PERFIL['artistas']],
      "novedades": nov2,
      "favoritas": [x for x in favs if ok(x)],
      "tendencias_co": [x for x in trending if ok(x)],
      "lo_mas_visto_hispano": [x for x in hispano if ok(x)][:60],
      "chart_semanal_co": [dict(c, id=c['id'] if c['id'] and ver.get(c['id'], {}).get('ok') else None) for c in chart_co],
      "stats": {"videos_verificados": len(ids), "descartados_oembed": descartados,
                "sin_verificar_por_error_red": sum(1 for v in ver.values() if v.get('ok') is None),
                "novedades_por_fuente": fuentes, "segundos": round(time.time() - t0, 1), "avisos": LOG},
    }
    # Protección: si una fuente falló (p. ej. YouTube bloquea la IP de GitHub), conservar los datos anteriores válidos
    try: viejo = json.load(open(OUT))
    except Exception: viejo = {}
    conservadas = []
    for k in ('novedades', 'favoritas', 'tendencias_co', 'lo_mas_visto_hispano', 'chart_semanal_co'):
        if not salida[k] and viejo.get(k):
            salida[k] = viejo[k]; conservadas.append(k)
    if viejo.get('novedades') and len(salida['novedades']) < len(viejo['novedades']) // 3:
        lim = (NOW - timedelta(days=DIAS_NOVEDAD)).strftime('%Y-%m-%d'); ya = {x['id'] for x in salida['novedades']}
        salida['novedades'] += [x for x in viejo['novedades'] if x['id'] not in ya and (x.get('fecha') or '') >= lim]
        salida['novedades'].sort(key=lambda x: x.get('fecha') or '', reverse=True); conservadas.append('novedades (mezcladas con las anteriores)')
    salida['stats']['conservadas_de_la_version_anterior'] = conservadas
    if not any(salida[k] for k in ('novedades', 'tendencias_co', 'lo_mas_visto_hispano')):
        print('ERROR: todas las fuentes vinieron vacías; no se sobrescribe', OUT); print(json.dumps(salida['stats'], ensure_ascii=False)); return
    json.dump(salida, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in salida.items() if k != 'stats'}, ensure_ascii=False))
    print(json.dumps(salida['stats'], ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
