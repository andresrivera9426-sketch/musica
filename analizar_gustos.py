#!/usr/bin/env python3
"""Analiza el Takeout de YouTube/YouTube Music de Andres y genera data/perfil.json
con gustos AGREGADOS (artistas, géneros, canciones más repetidas de artistas musicales).
No copia el historial crudo ni canales de noticias/política.
La asignación artista→género es una curaduría manual (ver GENEROS abajo)."""
import re, html, json, glob, collections, os

BASE = glob.glob('/workspace/takeout/Takeout/YouTube*')[0]
HIST = os.path.join(BASE, 'historial de videos', 'historial de reproducciones.html')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'perfil.json')

# artista: (género, [ids de canal vistos en el historial; el primero = canal oficial para novedades])
GENEROS = {
 "Indie folk / acústico": {
  "Novo Amor": ["UCqSxNFz4qIZA0tEkupipvKQ", "UCd8ndCH-sydKKRmftsx-lzw"],
  "SYML": ["UC1Qq0TRax_pgbnunNdQ_BpQ"],
  "Bon Iver": ["UCci2c90HJbY0VAS3_eLF3Wg"],
  "Hollow Coves": ["UCXXtcdTIu-usD7rrq1w0TAw", "UCdFx6Sk-JUFmIH4LIxV9Kpg"],
  "Gregory Alan Isakov": ["UCfVvroXVH8w4jLxFc5gNm7g", "UCiLwv1oZ3MGbdZHVYoKYYUQ"],
  "Sleeping At Last": ["UCvUYLLON82Gx6MW62xTLVLQ"],
  "Lowswimmer": ["UCDIaU1axvtrKGVn0vrIFjeA"],
  "Gert Taberner": ["UCr0SGuXTs5L7J5jRDxGiQWw"],
  "Them & I": ["UCa0PAgZ4tHl-XQXWRA8bGwg"],
  "Winter Aid": ["UCYrMIJLw-ApAbPSxBdJ5trA"],
  "Hazlett": ["UCMl_GVBYJQZgXjYY90H---A"],
  "The Lumineers": ["UCxjbV_Qr9gByQm1r8FV5FCA"],
  "Kodaline": ["UCfm1wtWNhY4Q09K0PX_h9Mw"],
  "Palace": ["UCBq7RQxzXo0bqK-aLuIiamQ"],
  "RY X": ["UCGUUYg1OxfDSpfZK5K073ZA"],
  "Lord Huron": ["UC48UiYdP4S_QuKZXSBcwawg"],
  "Chance Peña": ["UC4R3aq4zh0A2Vg-yFBIURTw"],
 },
 "Dream pop / indie alternativo": {
  "Bedroom": ["UCjeWu_Wkmgfd8L87cuR1bww", "UCsbNIycvmMqKCQrTx5X9-Kg"],
  "Beach House": ["UCN-jxm11fOETNF5JrZsATCg"],
  "Cemeteries": ["UCmJc--j9kQd83S0azxFnG6g"],
  "Cigarettes After Sex": ["UCqNxhPZoLJ81i5QaK4nqn8A"],
  "Lana Del Rey": ["UC3N5y6UWKJaKqoU2b_0MfTQ"],
 },
 "Música cristiana / worship": {
  "Generación 12": ["UCZq1DNdEdpmuN8LRSYQoyXg", "UCJNq4kn1Q0xVpCAw0bjEbhQ"],
  "Elevation Worship": ["UCSf-NCzjwcnXErUBW_qeFvA"],
  "Un Corazón": ["UCviQBmOy6buW21sypQ06WLA", "UCmjZ4oby51INRTSHar2arNA"],
  "Kairo Worship": ["UCZ7XstiQxRYMTsknvjKwgHQ", "UCz-NPH8vSHSElmVkdZ6B9bg"],
  "Fer Angell": ["UC-t116wGC3PzC823eoeSuTw", "UCZeJiC2F95vKUwSqp7qHXhQ"],
  "Hillsong UNITED": ["UCsOoQeBWPnfWBYAwmO795zg"],
  "Hillsong Worship": ["UC4q12NoPNySbVqwpw4iO5Vg"],
  "Kevin & Karla": ["UCVOzuq0ougZtYwN5fBLsvng"],
  "Tercer Cielo": ["UCpjVUrVVNPxFegat_FxrxCw"],
  "Catalina Castaño": ["UCghk3yQmXtrtZ7LLrOVoClA", "UCzpG3IkfdxvrPfD4ASsfBIA"],
  "Jesús Adrián Romero": ["UCL0G_Et4IZSqxN7CXL8bJJQ"],
  "Gateway Worship Español": ["UCvZgp9cvnS3P_T7KsfrgOyg"],
  "Genesis Benavides": ["UCnQTtadDaCkoJMEa3PucE8Q"],
 },
 "Rap / hip hop en español": {
  "Canserbero": ["UCSO14F6q-8T2iIFLlxEDewA", "UCMEBnTEWXX19tkFC8SSUU-Q", "UC-Gh7ndBnNZvGRjCzlt2Ecw"],
  "Al2 El Aldeano": ["UCYw09b1bNwXBickiw3k5aOw", "UCBUWeQ-kUl272221oGSjRgw"],
  "Nanpa Básico": ["UC4Boh-JJrLC60ZiNTaSwAxA", "UCcleeh_qNXu3VWSgnsZb-5g"],
  "Porta": ["UCjyx5ROt2HsFf-e4Qt5LAhg"],
  "Zafiro Rap": ["UCIdHK8mpK2wGMDbOUtHfX1Q"],
  "Xion MC": ["UCWvrIPM0vPi6QqiFCMgtA7g"],
 },
 "Lo-fi / chill / sad rap": {
  "Powfu": ["UC3V9WaOQ7RdHPRsEQ9gZvDA", "UC809pdzoMWSNMvbAoSSvuHA"],
  "Rxseboy": ["UCx4K56ccgugBVZPxxeFhq8w"],
  "Ali Gatie": ["UCsU2Dg39gd4_N9a7icS3b3A"],
  "Fasetya": ["UCTBsi8PDf1095_67DBFXYCw"],
  "Gustixa": ["UCGkq4cuLYKEOb1ndtSKVORQ"],
 },
 "Pop / rock en inglés": {
  "Harry Styles": ["UCbOCbp5gXL8jigIBZLqMPrw", "UCVacQ2t5GUZ2t_J3Ia9BynA"],
  "Coldplay": ["UCDPM_n1atn2ijUwHd0NNRQw", "UCIaFw5VBEK8qaW6nRpx_qnw"],
  "Snow Patrol": ["UCS4bqe_kRDbaKsrpqfHZ08A"],
  "Goo Goo Dolls": ["UCiEKDhv4v0YTc-ZtpABkXZA"],
  "James Blunt": ["UCUg8KhMXhFxJm-YQzOQ7nPw"],
 },
}
# Canales curadores (recopilan música nueva del mismo estilo); sirven para descubrir
CURADORES = {
 "Indie folk / acústico": {"WE ARE CHPTRS": "UCFbEc7F2WQ5HxnacuzTlUfQ", "IndieAir": "UCVoraDictyd89xgZt-J2Frw",
                           "Stumble on Tapes": "UCyyHOsTvUNVr9qdbZuM_j1w", "alexrainbirdMusic": "UCEi0EgWJ5m7gVBQ68a1L0TA"},
 "Lo-fi / chill / sad rap": {"cozy sounds.": "UCt2F-X_JagsMKJHRCpsSnCw", "7clouds": "UCNqFDjYTexJDET3rPDrmJKg"},
 "Música cristiana / worship": {"Cristianos Music Oficial": "UChNLgnIQzys6b8__nvCwzQQ"},
}

s = open(HIST, encoding='utf-8').read()
cells = re.findall(r'<div class="outer-cell.*?</div></div></div>', s, re.S)
por_canal = collections.Counter(); videos = collections.Counter(); titulos = {}; vid_canal = {}
total = len(cells); musica_yt = 0
for c in cells:
    hdr = re.search(r'mdl-typography--title">(.*?)<br', c).group(1)
    if hdr == 'YouTube Music': musica_yt += 1
    body = re.search(r'body-1">(.*?)</div>', c, re.S).group(1)
    links = re.findall(r'<a href="([^"]+)">(.*?)</a>', body)
    if len(links) < 2 or 'channel/' not in links[1][0]: continue
    cid = links[1][0].split('/')[-1]; por_canal[cid] += 1
    m = re.search(r'watch\?v=([A-Za-z0-9_-]{11})', links[0][0])
    if m:
        videos[m.group(1)] += 1; titulos[m.group(1)] = html.unescape(links[0][1]); vid_canal[m.group(1)] = cid

artistas = []; canal_artista = {}
for gen, arts in GENEROS.items():
    for nombre, ids in arts.items():
        n = sum(por_canal[i] for i in ids)
        artistas.append({"nombre": nombre, "genero": gen, "reproducciones": n, "canal": ids[0], "canales": ids})
        for i in ids: canal_artista[i] = (nombre, gen)
artistas.sort(key=lambda a: -a["reproducciones"])
generos = collections.Counter()
for a in artistas: generos[a["genero"]] += a["reproducciones"]
for gen, cur in CURADORES.items():
    for i in cur.values(): generos[gen] += por_canal[i]

favoritas = []
for v, n in videos.most_common():
    if v in vid_canal and vid_canal[v] in canal_artista:
        nombre, gen = canal_artista[vid_canal[v]]
        favoritas.append({"id": v, "titulo": titulos[v], "artista": nombre, "genero": gen, "veces": n})
perfil = {
  "fuente": "Google Takeout YouTube/YouTube Music (historial 12 jul – 7 oct 2026)",
  "resumen": {"eventos_historial": total, "eventos_youtube_music": musica_yt},
  "generos": [{"genero": g, "peso": n} for g, n in generos.most_common()],
  "artistas": artistas,
  "curadores": [{"nombre": n, "genero": g, "canal": c} for g, d in CURADORES.items() for n, c in d.items()],
  "favoritas": favoritas[:60],
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(perfil, open(OUT, 'w'), ensure_ascii=False, indent=1)
print("géneros:", perfil["generos"])
print("top artistas:", [(a["nombre"], a["reproducciones"]) for a in artistas[:20]])
print("favoritas:", len(favoritas))
