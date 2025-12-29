/**
 * IngramSpark Publisher
 *
 * Handles submission to IngramSpark for print and ebook distribution.
 * IngramSpark provides global distribution to bookstores and libraries.
 */

import { Pool } from 'pg';
import axios, { AxiosInstance } from 'axios';
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

export class IngramSparkPublisher implements PlatformPublisher {
  platform = 'ingram_spark' as const;
  private db: Pool;
  private validator: QualityValidator;
  private ingramClient: AxiosInstance;
  private outputDir: string;

  constructor(db: Pool) {
    this.db = db;
    this.validator = new QualityValidator();
    this.outputDir = path.join(config.storage.outputDir, 'ingram_submissions');
    this.ensureOutputDir();

    // IngramSpark API client (if API key available)
    this.ingramClient = axios.create({
      baseURL: 'https://api.ingramcontent.com/api/v1',
      headers: {
        'Authorization': `Bearer ${config.platforms.ingram_spark?.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info('IngramSparkPublisher initialized');
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create IngramSpark output directory', { error });
    }
  }

  /**
   * Submit book to IngramSpark
   *
   * IngramSpark Requirements:
   * - ISBN (required - IngramSpark doesn't provide ISBNs)
   * - Print PDF: CMYK, 300 DPI, with bleed
   * - Cover: Full wrap (front + spine + back), CMYK, 300 DPI
   * - EPUB3 for ebook
   */
  async submitBook(request: SubmissionRequest): Promise<SubmissionResult> {
    logger.info(`Preparing submission to IngramSpark: ${request.title}`);

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

      // 2. Check if API is available
      if (config.platforms.ingram_spark?.apiKey) {
        return await this.submitViaAPI(request);
      } else {
        return await this.prepareManualSubmission(request);
      }

    } catch (error: any) {
      logger.error('IngramSpark submission failed', {
        error: error.message,
        title: request.title,
      });
      throw new Error(`IngramSpark submission failed: ${error.message}`);
    }
  }

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

  async updateMetadata(submissionId: string, metadata: any): Promise<void> {
    await this.db.query(
      `UPDATE prose.platform_submissions
       SET submission_data = $1, updated_at = $2
       WHERE id = $3 AND platform = $4`,
      [metadata, new Date(), submissionId, this.platform]
    );
  }

  async validateFiles(request: SubmissionRequest): Promise<ValidationResult> {
    logger.info('Validating files for IngramSpark');

    const errors: any[] = [];
    const warnings: any[] = [];

    // 1. ISBN is required
    if (!request.isbn) {
      errors.push({
        code: 'MISSING_ISBN',
        message: 'ISBN is required for IngramSpark',
        severity: 'critical',
      });
    }

    // 2. Validate print PDF requirements
    // Note: Actual validation would check CMYK, 300 DPI, bleed, etc.
    if (request.manuscript.length > 500 * 1024 * 1024) {
      errors.push({
        code: 'PDF_TOO_LARGE',
        message: 'PDF exceeds 500 MB limit',
        severity: 'critical',
      });
    }

    return {
      valid: errors.filter((e: any) => e.severity === 'critical').length === 0,
      format: 'IngramSpark Submission',
      errors,
      warnings,
      quality_score: 100 - errors.length * 10 - warnings.length * 5,
      validated_at: new Date(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async submitViaAPI(request: SubmissionRequest): Promise<SubmissionResult> {
    logger.info('Submitting to IngramSpark via API');

    try {
      // Submit title metadata
      const response = await this.ingramClient.post('/titles', {
        isbn: request.isbn,
        title: request.title,
        author: request.author,
        publisher: 'Self-Published',
        description: request.description,
        price: request.price,
      });

      const submissionId = response.data.titleId;

      // Upload manuscript
      await this.ingramClient.post(`/titles/${submissionId}/files/interior`, {
        file: request.manuscript.toString('base64'),
        filename: 'manuscript.pdf',
      });

      // Upload cover
      await this.ingramClient.post(`/titles/${submissionId}/files/cover`, {
        file: request.cover.toString('base64'),
        filename: 'cover.pdf',
      });

      // Save submission record
      await this.saveSubmissionRecord(submissionId, request);

      return {
        submission_id: submissionId,
        platform: this.platform,
        status: 'submitted',
        platform_response: response.data,
        estimated_review_time: 7, // 7 days typical
      };

    } catch (error: any) {
      logger.error('IngramSpark API submission failed', { error: error.message });
      throw error;
    }
  }

  private async prepareManualSubmission(request: SubmissionRequest): Promise<SubmissionResult> {
    const submissionId = `ingram_${Date.now()}`;
    const packageDir = path.join(this.outputDir, submissionId);

    await fs.mkdir(packageDir, { recursive: true });

    // Save files
    await fs.writeFile(path.join(packageDir, 'interior.pdf'), request.manuscript);
    await fs.writeFile(path.join(packageDir, 'cover.pdf'), request.cover);

    // Save metadata
    const metadata = {
      isbn: request.isbn,
      title: request.title,
      author: request.author,
      description: request.description,
      price: request.price,
      territories: request.territories,
    };

    await fs.writeFile(
      path.join(packageDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Generate instructions
    const instructions = this.generateManualInstructions(request);

    await this.saveSubmissionRecord(submissionId, request);

    return {
      submission_id: submissionId,
      platform: this.platform,
      status: 'ready_for_upload',
      instructions: instructions.text,
      upload_url: 'https://www.ingramspark.com',
      estimated_review_time: 7,
    };
  }

  private generateManualInstructions(request: SubmissionRequest): { text: string } {
    const steps = [
      '=== IngramSpark Upload Instructions ===',
      '',
      '1. Go to https://www.ingramspark.com and sign in',
      '2. Click "Add a New Title"',
      '',
      '=== Title Information ===',
      '3. Enter title details:',
      `   - ISBN: ${request.isbn}`,
      `   - Title: ${request.title}`,
      `   - Author: ${request.author}`,
      '   - Language: English',
      '   - Publication Date: [Enter date]',
      '',
      '=== Physical Details (for Print) ===',
      '4. Specify book dimensions:',
      '   - Trim Size: 6" x 9" (or your chosen size)',
      '   - Binding: Perfect Bound',
      '   - Interior Color: Black & White or Color',
      '   - Paper Type: White or Cream',
      '',
      '=== Upload Files ===',
      '5. Upload Interior PDF:',
      '   - Must be CMYK color space',
      '   - 300 DPI minimum',
      '   - Include 0.125" bleed',
      '   - File: interior.pdf',
      '',
      '6. Upload Cover PDF:',
      '   - Full wrap (front + spine + back)',
      '   - CMYK color space',
      '   - 300 DPI minimum',
      '   - File: cover.pdf',
      '',
      '=== Pricing & Distribution ===',
      '7. Set wholesale discount: 55% recommended',
      `8. Set retail price: USD $${request.price}`,
      '9. Choose distribution channels:',
      '   ✓ Ingram (bookstores and libraries)',
      '   ✓ Amazon',
      '   ✓ Barnes & Noble',
      '   ✓ Baker & Taylor',
      '',
      '10. Review and Submit',
      '    - Review file will be available in 24-48 hours',
      '    - Approve or request changes',
      '    - Title goes live 3-5 business days after approval',
      '',
      '=== Important Notes ===',
      '- Setup fee: $49 (one-time per title)',
      '- No monthly fees',
      '- Returns: Choose returnable or non-returnable',
      '- POD (Print on Demand) - no inventory needed',
      '',
      '=== Support ===',
      'IngramSpark Support: https://www.ingramspark.com/contact-us',
    ];

    return { text: steps.join('\n') };
  }

  private async saveSubmissionRecord(
    submissionId: string,
    request: SubmissionRequest
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO prose.platform_submissions
       (id, project_id, platform, isbn, submission_date, status, submission_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        submissionId,
        request.isbn,
        this.platform,
        request.isbn,
        new Date(),
        'ready_for_upload',
        request,
      ]
    );
  }
}
