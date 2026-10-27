# Música Andrés (prototipo web)
- `analizar_gustos.py` → `data/perfil.json` (gustos agregados desde el Takeout).
- `update.py` → `data/musica.json` (novedades + tendencias CO). Correr 1 vez al día (cron: `15 6 * * * cd /workspace/musica-andres && python3 update.py`).
- `config.js` (copia de `config.ejemplo.js`): clave de YouTube Data API v3 para buscar en todo YouTube, respaldo Piped/Invidious (apagado por defecto), pantalla encendida.
- Probar local: `python3 -m http.server 8765 --bind localhost` y abrir **http://localhost:8765/** (con 127.0.0.1 YouTube bloquea muchos videos de sellos con error 150; no funciona con file://).
- Reproduce solo con el reproductor oficial de YouTube (IFrame API). No descarga, no aloja, no extrae audio.
- Segundo plano / pantalla apagada: prohibido por la política I.9 de YouTube API Services. Lo legal: botón 🔆 (mantener pantalla encendida) o ↗ (seguir en YouTube Music; con Premium suena en segundo plano).

## Publicación
GitHub Pages (Actions). El workflow `.github/workflows/actualizar.yml` corre `update.py` lun-vie 12:00 UTC (7:00 Bogotá), guarda `data/musica.json` y redepliega. Si una fuente falla, se conservan los datos anteriores.
