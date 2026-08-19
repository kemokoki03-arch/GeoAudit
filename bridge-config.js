/* GeoAudit GitHub Web -> local Windows Bridge adapter */
(() => {
  const BRIDGE = 'http://127.0.0.1:64819';
  window.GEOAUDIT_BRIDGE_URL = BRIDGE;
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || '';
      if (raw.startsWith('/api/')) {
        return originalFetch(BRIDGE + raw, init);
      }
    } catch (_) {}
    return originalFetch(input, init);
  };
})();
