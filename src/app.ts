/**
 * Express application setup
 */

import express, { Application } from 'express';
import { Pool } from 'pg';
import { createPublishingRoutes } from './routes/publishing.routes';
import { createISBNRoutes } from './routes/isbn.routes';
import { errorHandler } from './middleware/errorHandler';
import { usageTrackingMiddleware } from './middleware/usage-tracking';
import { logger } from './utils/logger';

export function createApp(db: Pool): Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Usage tracking middleware (before routes)
  app.use(usageTrackingMiddleware);

  // Logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'nexus-prosecreator-publisher',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api/publishing', createPublishingRoutes(db));
  app.use('/api/isbn', createISBNRoutes(db));

  // Error handling
  app.use(errorHandler);

  return app;
}
