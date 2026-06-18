/**
 * Dev proxy server – sits on port 8081 (where ngrok points) and routes:
 *   /api/*  → Express backend  (localhost:3000)
 *   *       → Expo dev server  (localhost:8082)
 *
 * Usage:  node dev-proxy.js
 *   Then start Expo on port 8082:  npx expo start --port 8082
 *   Then start ngrok:              ngrok http 8081
 */
const http = require('http');

const PROXY_PORT = 8081;
const EXPRESS_PORT = 3000;
const EXPO_PORT = 8082;

function proxy(req, res, targetPort) {
  // Strip origin/referer so Expo's CORS middleware doesn't reject ngrok requests.
  const headers = { ...req.headers, host: `localhost:${targetPort}` };
  delete headers.origin;
  delete headers.referer;

  const options = {
    hostname: 'localhost',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    const target = targetPort === EXPRESS_PORT ? 'Express' : 'Expo';
    console.error(`[proxy] ${target} (port ${targetPort}) unreachable: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `${target} backend not reachable on port ${targetPort}` }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    proxy(req, res, EXPRESS_PORT);
  } else {
    proxy(req, res, EXPO_PORT);
  }
});

// Also proxy WebSocket connections (needed for Expo HMR)
server.on('upgrade', (req, socket, head) => {
  const wsHeaders = { ...req.headers, host: `localhost:${EXPO_PORT}` };
  delete wsHeaders.origin;

  const options = {
    hostname: 'localhost',
    port: EXPO_PORT,
    path: req.url,
    method: req.method,
    headers: wsHeaders,
  };

  const proxyReq = http.request(options);
  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode || 101} ${proxyRes.statusMessage || 'Switching Protocols'}\r\n` +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n',
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => socket.end());
  proxyReq.end();
});

server.listen(PROXY_PORT, () => {
  console.log(`[dev-proxy] Listening on http://localhost:${PROXY_PORT}`);
  console.log(`[dev-proxy]   /api/*  → http://localhost:${EXPRESS_PORT} (Express)`);
  console.log(`[dev-proxy]   *       → http://localhost:${EXPO_PORT} (Expo)`);
  console.log(`[dev-proxy] Point ngrok to port ${PROXY_PORT}`);
});
