/**
 * Publishing routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PublishingOrchestrator } from '../services/PublishingOrchestrator';
import { logger } from '../utils/logger';

export function createPublishingRoutes(db: Pool): Router {
  const router = Router();
  const orchestrator = new PublishingOrchestrator(db);

  /**
   * POST /api/projects
   * Create new publishing project
   */
  router.post('/projects', async (req: Request, res: Response) => {
    try {
      const { prose_project_id, formats, distribution_channels } = req.body;

      logger.info('Creating publishing project', {
        prose_project_id,
        formats,
        channels: distribution_channels,
      });

      // In production, fetch chapters and metadata from ProseCreator service
      const mockData = {
        project_id: prose_project_id,
        title: 'Sample Book Title',
        author: 'John Doe',
        chapters: [],
        metadata: {
          title: 'Sample Book',
          author: 'John Doe',
          publisher: 'Self-Published',
          publication_date: new Date(),
          language: 'en',
          genre: 'fiction',
          subgenres: [],
          description: 'A compelling story...',
          bisac_categories: [],
          keywords: [],
          search_terms: [],
          price: { usd: 9.99 },
          royalty_percentage: 70,
        } as any,
        formats,
        distribution_channels,
      };

      const project = await orchestrator.publishBook(mockData);

      res.json(project);
    } catch (error: any) {
      logger.error('Failed to create project', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/projects/:id
   * Get publishing project status
   */
  router.get('/projects/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM prose.publishing_projects WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/projects/:id/publish
   * Start publishing pipeline
   */
  router.post('/projects/:id/publish', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // This would trigger the full pipeline
      res.json({ message: 'Publishing started', project_id: id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
