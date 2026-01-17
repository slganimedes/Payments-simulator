import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';

import { SERVER_PORT } from './config.js';
import { getDb } from './db.js';
import { createExpressApp } from './app.js';
import { startEngine } from './engine.js';

const db = getDb();
startEngine(db);

const app = createExpressApp(db);

const httpServer = http.createServer(app);

httpServer.on('clientError', (err, socket) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE')) return;
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch {
    // ignore
  }
});

httpServer.on('connection', (socket) => {
  socket.on('error', (err) => {
    if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE')) return;
  });
});

const vite = await createViteServer({
  root: 'web',
  server: {
    middlewareMode: true,
    allowedHosts: true,
    hmr: {
      server: httpServer
    }
  },
  appType: 'custom'
});

app.use(vite.middlewares);

// SPA fallback in dev
app.use('*', async (req, res, next) => {
  try {
    const url = req.originalUrl;
    let template = await vite.transformIndexHtml(url, `<!doctype html><html><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>Payment-simulator</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script></body></html>`);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`Payment-simulator (dev) listening on http://0.0.0.0:${SERVER_PORT}`);
});
