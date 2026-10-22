export function connectionHints(env) {
  const origins = new Set();
  try { if (env.VITE_API_URL) origins.add(new URL(env.VITE_API_URL).origin); } catch { }
  try {
    const encoded = env.VITE_CLERK_PUBLISHABLE_KEY?.split('_')[2];
    const domain = encoded && Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    if (domain && /^[a-z\d.-]+$/i.test(domain)) origins.add(`https://${domain}`);
  } catch { }
  return [...origins].filter(origin => /^https?:\/\//.test(origin)).map(href => ({
    tag: 'link', attrs: { rel: 'preconnect', href, crossorigin: 'anonymous' }, injectTo: 'head-prepend',
  }));
}

export function connectionHintsPlugin() {
  let env = {};
  return {
    name: 'backend-connection-hints',
    configResolved(config) { env = config.env; },
    transformIndexHtml() { return connectionHints(env); },
  };
}
