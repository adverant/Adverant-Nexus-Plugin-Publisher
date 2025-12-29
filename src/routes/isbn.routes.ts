/**
 * ISBN management routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ISBNManager } from '../services/ISBNManager';

export function createISBNRoutes(db: Pool): Router {
  const router = Router();
  const isbnManager = new ISBNManager(db);

  /**
   * POST /api/isbn/purchase
   * Purchase ISBNs from Bowker
   */
  router.post('/purchase', async (req: Request, res: Response) => {
    try {
      const { quantity, publisher_name, contact_info } = req.body;

      const isbns = await isbnManager.purchaseISBN({
        quantity,
        publisher_name,
        contact_info,
      });

      res.json({ isbns, count: isbns.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/isbn/available
   * List available ISBNs
   */
  router.get('/available', async (req: Request, res: Response) => {
    try {
      const isbns = await isbnManager.getAvailableISBNs();
      res.json({ isbns, count: isbns.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/isbn/:isbn/assign
   * Assign ISBN to project
   */
  router.post('/:isbn/assign', async (req: Request, res: Response) => {
    try {
      const { project_id, format } = req.body;

      const assigned = await isbnManager.assignISBN({
        project_id,
        format,
      });

      res.json(assigned);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
