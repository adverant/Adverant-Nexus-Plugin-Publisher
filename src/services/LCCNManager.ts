/**
 * LCCN (Library of Congress Control Number) Manager
 *
 * Handles LCCN applications for books to be cataloged in the
 * Library of Congress and other libraries worldwide.
 *
 * LCCNs are free and highly recommended for serious publishers.
 */

import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  LCCN,
  LCCNApplication,
  BookMetadata,
} from '../types';
import { logger } from '../utils/logger';

export class LCCNManager {
  private locClient: AxiosInstance;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;

    // Library of Congress API (if available)
    // Note: LC doesn't have a public API for LCCN applications yet
    this.locClient = axios.create({
      baseURL: 'https://www.loc.gov/publish',
      timeout: 30000,
    });

    logger.info('LCCNManager initialized');
  }

  /**
   * Apply for an LCCN (Library of Congress Control Number)
   *
   * Benefits:
   * - Free service from the Library of Congress
   * - Increases book's credibility
   * - Makes book easier to find in library catalogs
   * - Required for CIP (Cataloging in Publication)
   *
   * Requirements:
   * - Publisher must have a valid ISBN
   * - Book must be published in the United States
   * - Publisher must be based in the United States
   */
  async applyForLCCN(application: LCCNApplication): Promise<LCCN> {
    logger.info(`Applying for LCCN for book: ${application.title}`);

    try {
      // Generate application data
      const applicationData = this.generateApplicationData(application);

      // In production, this would submit to LOC API
      // For now, generate a placeholder LCCN and instructions
      const lccn = this.generatePlaceholderLCCN();

      // Store in database
      const result = await this.db.query(
        `INSERT INTO prose.lccns
         (id, project_id, lccn, status, application_date, assignment_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          uuidv4(),
          application.isbn, // Using ISBN as project identifier
          lccn,
          'pending',
          new Date(),
          null,
        ]
      );

      logger.info(`LCCN application created: ${lccn}`);

      // Return application instructions
      return {
        ...result.rows[0],
        instructions: this.generateApplicationInstructions(application),
      } as any;

    } catch (error: any) {
      logger.error('Failed to apply for LCCN', {
        error: error.message,
        title: application.title,
      });
      throw new Error(`LCCN application failed: ${error.message}`);
    }
  }

  /**
   * Get LCCN by project ID
   */
  async getByProjectId(projectId: string): Promise<LCCN | null> {
    const result = await this.db.query(
      `SELECT * FROM prose.lccns WHERE project_id = $1`,
      [projectId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update LCCN status
   */
  async updateStatus(params: {
    lccn: string;
    status: 'pending' | 'assigned' | 'published';
    assignment_date?: Date;
  }): Promise<void> {
    await this.db.query(
      `UPDATE prose.lccns
       SET status = $1, assignment_date = $2
       WHERE lccn = $3`,
      [params.status, params.assignment_date, params.lccn]
    );

    logger.info(`LCCN ${params.lccn} status updated to ${params.status}`);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateApplicationData(application: LCCNApplication): Record<string, any> {
    return {
      title: application.title,
      author: application.author,
      publisher: application.publisher,
      publication_date: application.publication_date,
      isbn: application.isbn,
      format: application.format,
      cip_requested: application.cip_data || false,
    };
  }

  private generatePlaceholderLCCN(): string {
    // LCCNs format: YYYY-NNNNNN (year + 6 digits)
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${year}-${sequence}`;
  }

  private generateApplicationInstructions(application: LCCNApplication): string[] {
    return [
      '=== LCCN Application Instructions ===',
      '',
      'The Library of Congress offers free LCCNs to U.S. publishers.',
      '',
      'Steps to apply:',
      '1. Go to https://www.loc.gov/publish/pcn/',
      '2. Create a publisher account (if you don\'t have one)',
      '3. Submit a request for a Preassigned Control Number (PCN)',
      '4. Provide the following information:',
      `   - Title: ${application.title}`,
      `   - Author: ${application.author}`,
      `   - Publisher: ${application.publisher}`,
      `   - Publication Date: ${application.publication_date}`,
      `   - ISBN: ${application.isbn}`,
      `   - Format: ${application.format}`,
      '5. Submit the application (free, no payment required)',
      '6. You will receive the LCCN within 1-2 weeks',
      '7. Print the LCCN on the copyright page of your book',
      '',
      'Optional: Request CIP Data (Cataloging in Publication)',
      '- Provides professional cataloging data for libraries',
      '- Requires submitting galley proofs 3-4 months before publication',
      '- Visit: https://www.loc.gov/publish/cip/',
      '',
      'Note: After publication, you must send 2 copies of the book to:',
      'Library of Congress',
      'Copyright Office',
      '101 Independence Avenue SE',
      'Washington, DC 20559-6000',
    ];
  }

  /**
   * Validate book meets LCCN requirements
   */
  validateLCCNEligibility(metadata: BookMetadata): {
    eligible: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check if book has ISBN
    if (!metadata.publisher) {
      reasons.push('Publisher name is required');
    }

    // Check if publication date is set
    if (!metadata.publication_date) {
      reasons.push('Publication date must be set');
    }

    // Check if book is in English or has English title
    if (metadata.language !== 'en' && metadata.language !== 'English') {
      reasons.push('Note: Books in languages other than English may have longer processing times');
    }

    return {
      eligible: reasons.filter(r => !r.startsWith('Note:')).length === 0,
      reasons,
    };
  }
}
