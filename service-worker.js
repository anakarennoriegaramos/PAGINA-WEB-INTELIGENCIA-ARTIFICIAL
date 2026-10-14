
/* ==========================================
   PWA DE INTELIGENCIA ARTIFICIAL
   CBTis 260
   Memoria caché y API Cache
   ========================================== */

// Nombre y versión de la caché.
const NOMBRE_CACHE = "ia-pwa-cache-v1";

// Archivos principales que se guardarán
// para que la aplicación pueda abrirse sin Internet.
const ARCHIVOS_CACHE = [
  "./",
  "./index.html",
  "./estilos.css",
  "./manifest.json",
  "./imagenes/logo_dgeti.png",
  "./imagenes/inteligencia_artificial.jpg"
];


/* ==========================================
   1. INSTALACIÓN DEL SERVICE WORKER
   ========================================== */

self.addEventListener("install", (evento) => {
  console.log("Instalando Service Worker...");

  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(async (cache) => {

      // MÉTODO 1: addAll()
      // Guarda todos los archivos indicados en la caché.
      await cache.addAll(ARCHIVOS_CACHE);

      console.log("Archivos guardados en memoria caché.");

      // Activa el nuevo Service Worker sin esperar
      // a que se cierre la página anterior.
      return self.skipWaiting();
    })
  );
});


/* ==========================================
   2. ACTIVACIÓN DEL SERVICE WORKER
   ========================================== */

self.addEventListener("activate", (evento) => {
  console.log("Service Worker activado.");

  evento.waitUntil(
    caches.keys().then(async (nombresCaches) => {

      // Elimina las versiones antiguas de la caché.
      const cachesAntiguas = nombresCaches.filter(
        (nombre) =>
          nombre.startsWith("ia-pwa-cache-") &&
          nombre !== NOMBRE_CACHE
      );

      await Promise.all(
        cachesAntiguas.map((nombre) => caches.delete(nombre))
      );

      // Permite que el Service Worker controle la página.
      await self.clients.claim();

      console.log("Caché actualizada correctamente.");
    })
  );
});


/* ==========================================
   3. INTERCEPTAR LAS SOLICITUDES
   ========================================== */

self.addEventListener("fetch", (evento) => {
  const solicitud = evento.request;

  // Solo procesamos solicitudes GET.
  if (solicitud.method !== "GET") {
    return;
  }

  // No interceptamos solicitudes a otros dominios.
  const url = new URL(solicitud.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  evento.respondWith(
    responderSolicitud(solicitud)
  );
});


/* ==========================================
   4. CONSULTAR Y ACTUALIZAR LA CACHÉ
   ========================================== */

async function responderSolicitud(solicitud) {
  const cache = await caches.open(NOMBRE_CACHE);

  // MÉTODO 2: match()
  // Busca primero si el archivo ya está guardado.
  const respuestaCache = await cache.match(solicitud);

  // Para las páginas HTML intentamos consultar
  // primero la versión más reciente de Internet.
  const esPagina =
    solicitud.mode === "navigate" ||
    solicitud.destination === "document";

  if (esPagina) {
    try {
      const respuestaRed = await fetch(solicitud);

      if (respuestaRed.ok) {
        // MÉTODO 3: put()
        // Guarda o actualiza la respuesta recibida.
        await cache.put(
          solicitud,
          respuestaRed.clone()
        );
      } else if (respuestaRed.status === 404) {
        // MÉTODO 4: delete()
        // Elimina una versión guardada si el servidor
        // confirma que esa página ya no existe.
        await cache.delete(solicitud);
      }

      return respuestaRed;

    } catch (error) {
      console.log("Sin Internet. Buscando la página en caché.");

      // Si no hay conexión, mostramos la página guardada.
      if (respuestaCache) {
        return respuestaCache;
      }

      // Como alternativa, intentamos abrir el inicio.
      const paginaInicio = await cache.match("./index.html");

      if (paginaInicio) {
        return paginaInicio;
      }

      return new Response(
        "No hay conexión y esta página no está guardada.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }
  }

  // Para CSS, imágenes y otros recursos:
  // si están guardados, se utilizan directamente.
  if (respuestaCache) {
    return respuestaCache;
  }

  // Si el recurso no está en caché, se solicita a Internet.
  try {
    const respuestaRed = await fetch(solicitud);

    if (respuestaRed.ok) {
      // Se guarda una copia para la próxima visita.
      await cache.put(
        solicitud,
        respuestaRed.clone()
      );
    }

    return respuestaRed;

  } catch (error) {
    return new Response(
      "Este recurso no está disponible sin conexión.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }
    );
  }
}
