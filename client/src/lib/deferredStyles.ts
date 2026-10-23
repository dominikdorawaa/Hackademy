export function enableDeferredStyles() {
  document.querySelectorAll<HTMLLinkElement>('link[data-deferred-style]').forEach(link => { link.media = 'all'; });
}
