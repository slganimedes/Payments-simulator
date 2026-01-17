import path from 'path';
import express from 'express';

import { SERVER_PORT } from './config.js';
import { getDb } from './db.js';
import { createExpressApp } from './app.js';
import { startEngine } from './engine.js';

const db = getDb();
startEngine(db);

const app = createExpressApp(db);

const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`Payment-simulator listening on http://0.0.0.0:${SERVER_PORT}`);
});
