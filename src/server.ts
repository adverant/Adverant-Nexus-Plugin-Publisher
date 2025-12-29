/**
 * Server entry point
 */

import { Pool } from 'pg';
import { WebSocketServer } from 'ws';
import http from 'http';
import { createApp } from './app';
import { serverConfig } from './config';
import { logger } from './utils/logger';
import { PublishingOrchestrator } from './services/PublishingOrchestrator';

// Database connection
const db = new Pool({
  connectionString: serverConfig.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create Express app
const app = createApp(db);

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time publishing progress
const wss = new WebSocketServer({ server, path: '/ws/publishing' });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  // Create orchestrator for this connection
  const orchestrator = new PublishingOrchestrator(db);

  // Forward progress events to WebSocket client
  orchestrator.on('progress', (event) => {
    ws.send(JSON.stringify(event));
  });

  orchestrator.on('error', (event) => {
    ws.send(JSON.stringify(event));
  });

  orchestrator.on('complete', (event) => {
    ws.send(JSON.stringify(event));
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

// Start server
server.listen(serverConfig.port, () => {
  logger.info(`Publisher Service listening on port ${serverConfig.port}`);
  logger.info(`Environment: ${serverConfig.nodeEnv}`);
  logger.info(`WebSocket endpoint: ws://localhost:${serverConfig.port}/ws/publishing`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
  });
  await db.end();
  logger.info('Database connections closed');
  process.exit(0);
});

export { app, server, db };
