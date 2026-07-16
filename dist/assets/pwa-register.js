if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(
      OsadaFabrycznaPwa.serviceWorkerUrl,
      { scope: OsadaFabrycznaPwa.scope }
    ).catch(function (error) {
      console.warn('PWA service worker registration failed.', error);
    });
  });
}
