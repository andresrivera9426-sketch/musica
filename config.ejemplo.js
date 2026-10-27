// Copia este archivo como config.js y rellena lo que necesites. config.js NO se debe compartir si tiene clave.
window.MUSICA_CONFIG = {
  // Clave de la YouTube Data API v3 (gratis en https://console.cloud.google.com → "YouTube Data API v3" → Credenciales → Clave de API).
  // Restríngela en Google Cloud a "Sitios web (HTTP referrers)" con la URL donde publiques la página y a la API "YouTube Data API v3".
  // Cupo gratis: 10.000 unidades/día; cada búsqueda cuesta 100 → ~100 búsquedas al día.
  youtubeApiKey: "",
  region: "CO",
  // Respaldo SIN clave mediante instancias públicas de Piped/Invidious (solo para obtener títulos e IDs; el audio
  // y el video siguen saliendo del reproductor oficial de YouTube). OJO: estos servicios leen YouTube por fuera de
  // la API oficial; usarlos choca con la política I.14 de YouTube API Services. Por eso viene APAGADO (false).
  busquedaTerceros: false,
  instanciasPiped: ["https://api.piped.private.coffee", "https://pipedapi.ducks.party", "https://pipedapi.kavin.rocks"],
  instanciasInvidious: ["https://yt.chocolatemoo53.com"],
  // Mantener la pantalla encendida mientras suena (Screen Wake Lock API). Recomendado en celular.
  mantenerPantalla: true,
};
