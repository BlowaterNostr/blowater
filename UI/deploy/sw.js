const cacheName = "blowater-pwa";
const contentToCache = [
    "./index.html",
    "./alby-logo.svg",
    "./logo-white.png",
    "./logo.ico",
    "./logo.png",
    "./main.mjs",
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        (async () => {
            const cache = await caches.open(cacheName);
            await cache.addAll(contentToCache);
        })(),
    );
});

const putInCache = async (request, response) => {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
};

const cacheFirst = async ({ request }) => {
    const responseFromCache = await caches.match(request);
    (async () => {
        try {
            const responseFromNetwork = await fetch(request);
            putInCache(request, responseFromNetwork.clone());
        } catch (error) {
            // ignore
        }
    })();
    if (responseFromCache) {
        return responseFromCache;
    }

    try {
        const responseFromNetwork = await fetch(request);
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        return new Response(error.message ? error.message : error, {
            status: 500,
            headers: { "Content-Type": "text/plain" },
        });
    }
};

self.addEventListener("fetch", (event) => {
    event.respondWith(
        cacheFirst({
            request: event.request,
        }),
    );
});
