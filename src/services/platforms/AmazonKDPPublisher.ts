/**
 * Amazon KDP (Kindle Direct Publishing) Publisher
 *
 * Handles submission to Amazon KDP for Kindle ebooks and print books.
 *
 * Note: Amazon KDP doesn't have a public API yet. This service prepares
 * all files and metadata for manual upload through the KDP dashboard.
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PlatformPublisher,
  SubmissionRequest,
  SubmissionResult,
  PlatformSubmission,
  ValidationResult,
} from '../../types';
import { QualityValidator } from '../QualityValidator';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export class AmazonKDPPublisher implements PlatformPublisher {
  platform = 'amazon_kdp' as const;
  private db: Pool;
  private validator: QualityValidator;
  private outputDir: string;

  constructor(db: Pool) {
    this.db = db;
    this.validator = new QualityValidator();
    this.outputDir = path.join(config.storage.outputDir, 'kdp_submissions');
    this.ensureOutputDir();

    logger.info('AmazonKDPPublisher initialized');
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create KDP output directory', { error });
    }
  }

  /**
   * Submit book to Amazon KDP
   *
   * Amazon KDP Requirements:
   * - ISBN (optional but recommended)
   * - MOBI or EPUB for ebook
   * - PDF for print
   * - Cover: 2560x1600 minimum, JPG or TIFF
   * - Metadata: title, author, description, categories (2), keywords (7)
   */
  async submitBook(request: SubmissionRequest): Promise<SubmissionResult> {
    logger.info(`Preparing submission to Amazon KDP: ${request.title}`);

    try {
      // 1. Validate files
      const validation = await this.validateFiles(request);

      if (!validation.valid) {
        const criticalErrors = validation.errors.filter(e => e.severity === 'critical');
        if (criticalErrors.length > 0) {
          return {
            submission_id: '',
            platform: this.platform,
            status: 'error',
            instructions: `Validation failed: ${criticalErrors[0].message}`,
          };
        }
      }

      // 2. Prepare submission package
      const submissionId = await this.prepareSubmissionPackage(request);

      // 3. Generate upload instructions
      const instructions = this.generateUploadInstructions(request);

      // 4. Save submission record
      await this.saveSubmissionRecord(submissionId, request);

      logger.info(`KDP submission prepared: ${submissionId}`);

      return {
        submission_id: submissionId,
        platform: this.platform,
        status: 'ready_for_upload',
        instructions: instructions.text,
        upload_url: 'https://kdp.amazon.com/en_US/',
        estimated_review_time: 3, // 72 hours typical
      };

    } catch (error: any) {
      logger.error('KDP submission failed', {
        error: error.message,
        title: request.title,
      });
      throw new Error(`KDP submission failed: ${error.message}`);
    }
  }

  /**
   * Check submission status
   *
   * Currently requires manual checking via KDP dashboard
   */
  async checkSubmissionStatus(submissionId: string): Promise<PlatformSubmission> {
    const result = await this.db.query(
      `SELECT * FROM prose.platform_submissions WHERE id = $1 AND platform = $2`,
      [submissionId, this.platform]
    );

    if (result.rows.length === 0) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Update book metadata
   *
   * Currently requires manual update via KDP dashboard
   */
  async updateMetadata(submissionId: string, metadata: any): Promise<void> {
    logger.info(`Updating metadata for submission ${submissionId}`);

    await this.db.query(
      `UPDATE prose.platform_submissions
       SET submission_data = $1, updated_at = $2
       WHERE id = $3 AND platform = $4`,
      [metadata, new Date(), submissionId, this.platform]
    );
  }

  /**
   * Validate files for KDP submission
   */
  async validateFiles(request: SubmissionRequest): Promise<ValidationResult> {
    logger.info('Validating files for Amazon KDP');

    const errors: any[] = [];
    const warnings: any[] = [];

    // 1. Validate manuscript (MOBI/EPUB)
    // Simplified - in production, use actual validation
    if (request.manuscript.length > 650 * 1024 * 1024) {
      errors.push({
        code: 'MANUSCRIPT_TOO_LARGE',
        message: 'Manuscript exceeds 650 MB limit',
        severity: 'critical',
      });
    }

    // 2. Validate cover
    if (request.cover.length === 0) {
      errors.push({
        code: 'MISSING_COVER',
        message: 'Cover image is required',
        severity: 'critical',
      });
    }

    // 3. Validate metadata
    if (!request.title || request.title.length === 0) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Title is required',
        severity: 'critical',
      });
    }

    if (!request.author || request.author.length === 0) {
      errors.push({
        code: 'MISSING_AUTHOR',
        message: 'Author is required',
        severity: 'critical',
      });
    }

    if (request.categories.length > 2) {
      warnings.push({
        code: 'TOO_MANY_CATEGORIES',
        message: 'Amazon KDP allows only 2 categories',
        impact: 'medium',
      });
    }

    if (request.keywords.length > 7) {
      warnings.push({
        code: 'TOO_MANY_KEYWORDS',
        message: 'Amazon KDP allows only 7 keywords',
        impact: 'low',
      });
    }

    return {
      valid: errors.filter((e: any) => e.severity === 'critical').length === 0,
      format: 'KDP Submission',
      errors,
      warnings,
      quality_score: 100 - errors.length * 10 - warnings.length * 5,
      validated_at: new Date(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async prepareSubmissionPackage(request: SubmissionRequest): Promise<string> {
    const submissionId = `kdp_${Date.now()}`;
    const packageDir = path.join(this.outputDir, submissionId);

    await fs.mkdir(packageDir, { recursive: true });

    // Save manuscript
    await fs.writeFile(
      path.join(packageDir, 'manuscript.mobi'),
      request.manuscript
    );

    // Save cover
    await fs.writeFile(
      path.join(packageDir, 'cover.jpg'),
      request.cover
    );

    // Save metadata
    const metadata = {
      title: request.title,
      author: request.author,
      description: request.description,
      categories: request.categories.slice(0, 2),
      keywords: request.keywords.slice(0, 7),
      isbn: request.isbn,
      price: request.price,
      territories: request.territories,
      drm_enabled: request.drm_enabled ?? true,
    };

    await fs.writeFile(
      path.join(packageDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    logger.info(`Submission package created: ${packageDir}`);

    return submissionId;
  }

  private generateUploadInstructions(request: SubmissionRequest): {
    text: string;
    steps: string[];
  } {
    const steps = [
      '=== Amazon KDP Upload Instructions ===',
      '',
      '1. Go to https://kdp.amazon.com/en_US/ and sign in',
      '2. Click "Create New Title" (or "+ Kindle eBook" / "+ Paperback")',
      '',
      '=== Kindle eBook Details ===',
      '3. Enter the following information:',
      `   - Language: English`,
      `   - Book Title: ${request.title}`,
      `   - Author: ${request.author}`,
      `   - Description: ${request.description.substring(0, 100)}...`,
      `   - Categories: ${request.categories.slice(0, 2).join(', ')}`,
      `   - Keywords: ${request.keywords.slice(0, 7).join(', ')}`,
      request.isbn ? `   - ISBN: ${request.isbn}` : '',
      '',
      '4. Upload Content:',
      '   - Click "Upload eBook manuscript"',
      `   - Select the file: manuscript.mobi`,
      '   - Wait for processing (1-2 minutes)',
      '',
      '5. Upload Cover:',
      '   - Click "Upload a cover you already have"',
      `   - Select the file: cover.jpg`,
      '',
      '=== Pricing ===',
      '6. Set Pricing:',
      `   - Primary Marketplace: Amazon.com - USD $${request.price}`,
      `   - Territories: ${request.territories.join(', ')}`,
      '   - Enrollment: Choose KDP Select (optional, 90-day exclusivity)',
      `   - DRM: ${request.drm_enabled ? 'Enable' : 'Disable'}`,
      '',
      '7. Review and Publish:',
      '   - Preview your book (use online previewer)',
      '   - Click "Publish Your Kindle eBook"',
      '   - Wait for review (typically 72 hours)',
      '',
      '=== Important Notes ===',
      '- Your book will be live within 24-72 hours after review',
      '- You can make changes anytime, but updates take 12-24 hours',
      '- Track sales in KDP Reports section',
      '- Payments sent 60 days after end of month',
      '',
      '=== Support ===',
      'Amazon KDP Support: https://kdp.amazon.com/en_US/help',
    ];

    return {
      text: steps.join('\n'),
      steps,
    };
  }

  private async saveSubmissionRecord(
    submissionId: string,
    request: SubmissionRequest
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO prose.platform_submissions
       (id, project_id, platform, isbn, submission_date, publication_date,
        status, platform_id, submission_data, review_notes, live_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        submissionId,
        request.isbn, // Using ISBN as project_id temporarily
        this.platform,
        request.isbn,
        new Date(),
        null, // Will be set when published
        'ready_for_upload',
        null, // ASIN assigned after publication
        request,
        null,
        null,
      ]
    );
  }
}
