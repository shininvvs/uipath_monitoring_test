self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "notify") {
    const { title, body, tag } = data;
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
    });
  }
});
