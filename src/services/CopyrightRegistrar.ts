/**
 * Copyright Registration Service
 *
 * Handles copyright registration with the U.S. Copyright Office.
 * Note: The Copyright Office doesn't have a public API yet, so this service
 * generates Form TX and prepares deposit copies for manual submission via eCO.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CopyrightRegistration,
  FormTX,
  CopyrightSubmissionInstructions,
  BookMetadata,
} from '../types';
import { config, serverConfig } from '../config';
import { logger } from '../utils/logger';

export class CopyrightRegistrar {
  private db: Pool;
  private storageDir: string;

  constructor(db: Pool) {
    this.db = db;
    this.storageDir = path.join(config.storage.outputDir, 'copyright');
    this.ensureStorageDir();

    logger.info('CopyrightRegistrar initialized');
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create copyright storage directory', { error });
    }
  }

  /**
   * Register copyright for a book
   *
   * Generates Form TX and prepares deposit copy for submission to
   * the U.S. Copyright Office via eCO (Electronic Copyright Office).
   *
   * Cost: $65 for online registration
   * Processing time: ~8 months typically
   */
  async registerCopyright(params: {
    project_id: string;
    title: string;
    subtitle?: string;
    author: string;
    manuscript_file: Buffer;
    metadata?: BookMetadata;
  }): Promise<CopyrightRegistration> {
    logger.info(`Registering copyright for project ${params.project_id}`);

    try {
      const registrationId = uuidv4();

      // Generate Form TX (Literary Works)
      const formData = this.generateFormTX({
        title: params.title,
        subtitle: params.subtitle,
        author: params.author,
        publication_date: params.metadata?.publication_date || new Date(),
        work_type: 'Literary work',
      });

      // Prepare deposit copy (save manuscript)
      const depositCopyPath = await this.prepareDepositCopy(
        registrationId,
        params.manuscript_file
      );

      // Save form as JSON
      const formPath = path.join(this.storageDir, `${registrationId}_form_tx.json`);
      await fs.writeFile(formPath, JSON.stringify(formData, null, 2));

      // Store in database
      const result = await this.db.query(
        `INSERT INTO prose.copyright_registrations
         (id, project_id, registration_id, title, author, form_data, deposit_copy,
          status, filing_date, registration_date, registration_number, cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          uuidv4(),
          params.project_id,
          registrationId,
          params.title,
          params.author,
          formData,
          depositCopyPath,
          'pending',
          new Date(),
          null,
          null,
          config.costs.copyright_registration,
        ]
      );

      const registration: CopyrightRegistration = result.rows[0];

      // Generate submission instructions
      const instructions = this.generateSubmissionInstructions(registration);

      logger.info(`Copyright registration prepared: ${registrationId}`);

      // In production, could integrate with copyright.gov eCO API when available
      // For now, users must manually submit via https://eco.copyright.gov

      return {
        ...registration,
        instructions,
      } as any;

    } catch (error: any) {
      logger.error('Failed to prepare copyright registration', {
        error: error.message,
        project_id: params.project_id,
      });
      throw new Error(`Copyright registration failed: ${error.message}`);
    }
  }

  /**
   * Generate Form TX (Copyright Registration for Literary Works)
   */
  private generateFormTX(data: {
    title: string;
    subtitle?: string;
    author: string;
    publication_date: Date;
    work_type: string;
  }): FormTX {
    const fullTitle = data.subtitle
      ? `${data.title}: ${data.subtitle}`
      : data.title;

    return {
      form_type: 'TX',
      title_of_work: fullTitle,
      author: {
        name: data.author,
        citizenship: 'USA', // Default, should be configurable
        domicile: 'USA',
      },
      claimant: data.author,
      year_of_completion: new Date().getFullYear(),
      publication: {
        published: true,
        date: data.publication_date,
        nation: 'USA',
      },
    };
  }

  /**
   * Prepare deposit copy (manuscript file)
   */
  private async prepareDepositCopy(
    registrationId: string,
    manuscript: Buffer
  ): Promise<string> {
    const filename = `${registrationId}_deposit_copy.pdf`;
    const filepath = path.join(this.storageDir, filename);

    await fs.writeFile(filepath, manuscript);

    logger.info(`Deposit copy saved: ${filepath}`);
    return filepath;
  }

  /**
   * Generate submission instructions for user
   */
  private generateSubmissionInstructions(
    registration: CopyrightRegistration
  ): CopyrightSubmissionInstructions {
    const estimatedCompletion = this.addMonths(new Date(), 8); // ~8 months typical

    return {
      registration_id: registration.registration_id!,
      form_download_url: `file://${path.join(
        this.storageDir,
        `${registration.registration_id}_form_tx.json`
      )}`,
      deposit_copy_path: registration.deposit_copy,
      submission_url: 'https://eco.copyright.gov',
      payment_amount: config.costs.copyright_registration,
      estimated_completion: estimatedCompletion,
      steps: [
        '1. Go to https://eco.copyright.gov and create an account (if you don\'t have one)',
        '2. Click "Register a New Claim"',
        '3. Select "Literary Work" as the type of work',
        '4. Fill in the form using the data from the downloaded Form TX JSON',
        '5. Upload the deposit copy (manuscript PDF)',
        '6. Pay the $65 registration fee',
        '7. Submit the application',
        '8. Save the confirmation number and check status periodically',
        '9. You will receive the copyright certificate by email in ~8 months',
      ],
    };
  }

  /**
   * Get copyright registration by project ID
   */
  async getByProjectId(projectId: string): Promise<CopyrightRegistration | null> {
    const result = await this.db.query(
      `SELECT * FROM prose.copyright_registrations WHERE project_id = $1`,
      [projectId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update copyright registration status
   */
  async updateStatus(params: {
    registration_id: string;
    status: 'pending' | 'submitted' | 'registered' | 'rejected';
    registration_number?: string;
    registration_date?: Date;
  }): Promise<void> {
    await this.db.query(
      `UPDATE prose.copyright_registrations
       SET status = $1, registration_number = $2, registration_date = $3
       WHERE registration_id = $4`,
      [
        params.status,
        params.registration_number,
        params.registration_date,
        params.registration_id,
      ]
    );

    logger.info(`Copyright registration ${params.registration_id} status updated to ${params.status}`);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}
