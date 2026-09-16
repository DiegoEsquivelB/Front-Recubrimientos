const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const httpProxy = require('http-proxy');

const PORT = Number(process.env.PORT || 3000);
const API_BASE_URL = String(process.env.API_BASE_URL || '').replace(/\/$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!API_BASE_URL) {
  throw new Error('La variable de entorno API_BASE_URL es obligatoria.');
}

try {
  const apiUrl = new URL(API_BASE_URL);
  if (!['http:', 'https:'].includes(apiUrl.protocol)) {
    throw new Error('El protocolo debe ser http o https.');
  }
} catch (error) {
  throw new Error(`API_BASE_URL no es válida: ${error.message}`);
}

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
  secure: true
});

proxy.on('proxyReq', (proxyReq, req) => {
  // http-proxy reenvía las cabeceras, incluida Cookie; se fuerza explícitamente para preservar la sesión.
  if (req.headers.cookie) {
    proxyReq.setHeader('cookie', req.headers.cookie);
  }
}
);

proxy.on('error', (error, req, res) => {
  console.error('Error del proxy:', error.message);
  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ message: 'La API no está disponible en este momento.' }));
});

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (_error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Solicitud inválida.');
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  const publicPrefix = `${PUBLIC_DIR}${path.sep}`;

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(publicPrefix)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado.');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Recurso no encontrado.');
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/api' || req.url.startsWith('/api/')) {
    proxy.web(req, res, { target: API_BASE_URL });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend disponible en el puerto ${PORT}`);
  console.log(`Proxy de API configurado hacia ${API_BASE_URL}`);
});
