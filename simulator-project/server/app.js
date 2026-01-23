import express from 'express';

import { buildApiRouter } from './api.js';

export function createExpressApp(db) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', buildApiRouter(db));

  app.use((err, req, res, next) => {
    const msg = String(err?.message ?? err);
    if (res.headersSent) return next(err);
    res.status(400).type('text/plain').send(msg);
  });

  return app;
}
