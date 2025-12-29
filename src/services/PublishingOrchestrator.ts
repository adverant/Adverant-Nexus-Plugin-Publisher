/**
 * Publishing Orchestrator
 *
 * Coordinates the entire publishing pipeline:
 * 1. ISBN acquisition
 * 2. Copyright registration
 * 3. LCCN application
 * 4. Format conversion (EPUB, MOBI, PDF)
 * 5. Cover generation
 * 6. Metadata optimization
 * 7. Quality validation
 * 8. Platform submissions
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  PublishingProject,
  PublishingPipeline,
  PublishingPhaseStatus,
  PublishingFormat,
  DistributionChannel,
  Chapter,
  BookMetadata,
  CostBreakdown,
} from '../types';
import { ISBNManager } from './ISBNManager';
import { CopyrightRegistrar } from './CopyrightRegistrar';
import { LCCNManager } from './LCCNManager';
import { FormatConverter } from './FormatConverter';
import { CoverDesigner } from './CoverDesigner';
import { MetadataOptimizer } from './MetadataOptimizer';
import { QualityValidator } from './QualityValidator';
import { AmazonKDPPublisher } from './platforms/AmazonKDPPublisher';
import { IngramSparkPublisher } from './platforms/IngramSparkPublisher';
import { Draft2DigitalPublisher } from './platforms/Draft2DigitalPublisher';
import { FindawayVoicesPublisher } from './platforms/FindawayVoicesPublisher';
import { config } from '../config';
import { logger } from '../utils/logger';

export class PublishingOrchestrator extends EventEmitter {
  private db: Pool;
  private isbnManager: ISBNManager;
  private copyrightRegistrar: CopyrightRegistrar;
  private lccnManager: LCCNManager;
  private formatConverter: FormatConverter;
  private coverDesigner: CoverDesigner;
  private metadataOptimizer: MetadataOptimizer;
  private qualityValidator: QualityValidator;

  // Platform publishers
  private publishers: {
    amazon_kdp: AmazonKDPPublisher;
    ingram_spark: IngramSparkPublisher;
    draft2digital: Draft2DigitalPublisher;
    findaway_voices: FindawayVoicesPublisher;
  };

  constructor(db: Pool) {
    super();
    this.db = db;

    // Initialize services
    this.isbnManager = new ISBNManager(db);
    this.copyrightRegistrar = new CopyrightRegistrar(db);
    this.lccnManager = new LCCNManager(db);
    this.formatConverter = new FormatConverter(db);
    this.coverDesigner = new CoverDesigner(db);
    this.metadataOptimizer = new MetadataOptimizer(db);
    this.qualityValidator = new QualityValidator();

    // Initialize platform publishers
    this.publishers = {
      amazon_kdp: new AmazonKDPPublisher(db),
      ingram_spark: new IngramSparkPublisher(db),
      draft2digital: new Draft2DigitalPublisher(db),
      findaway_voices: new FindawayVoicesPublisher(db),
    };

    logger.info('PublishingOrchestrator initialized');
  }

  /**
   * Publish a book through the complete pipeline
   *
   * @param params Publishing parameters
   * @returns Publishing project with all results
   */
  async publishBook(params: {
    project_id: string;
    title: string;
    author: string;
    chapters: Chapter[];
    metadata: BookMetadata;
    formats: PublishingFormat[];
    distribution_channels: DistributionChannel[];
  }): Promise<PublishingProject> {
    logger.info(`Starting publishing pipeline for project ${params.project_id}`);

    const pipeline: PublishingPipeline = {
      project_id: params.project_id,
      current_phase: { name: 'Initializing', order: 0, status: 'pending', progress: 0 },
      progress_percentage: 0,
      phases: [],
      started_at: new Date(),
    };

    try {
      // ========================================================================
      // Phase 1: ISBN Acquisition (10%)
      // ========================================================================
      await this.runPhase(pipeline, 'isbn_acquisition', async () => {
        const isbns = [];

        // Acquire ISBN for each format
        for (const format of params.formats) {
          const isbn = await this.isbnManager.assignISBN({
            project_id: params.project_id,
            format,
          });
          isbns.push(isbn);
        }

        return { isbns };
      });

      // ========================================================================
      // Phase 2: Copyright Registration (20%)
      // ========================================================================
      await this.runPhase(pipeline, 'copyright_registration', async () => {
        // Get manuscript buffer
        const manuscriptBuffer = Buffer.from(
          params.chapters.map(c => c.content).join('\n\n')
        );

        const copyright = await this.copyrightRegistrar.registerCopyright({
          project_id: params.project_id,
          title: params.metadata.title,
          subtitle: params.metadata.subtitle,
          author: params.metadata.author,
          manuscript_file: manuscriptBuffer,
          metadata: params.metadata,
        });

        return { copyright };
      });

      // ========================================================================
      // Phase 3: LCCN Application (30%)
      // ========================================================================
      await this.runPhase(pipeline, 'lccn_application', async () => {
        const lccn = await this.lccnManager.applyForLCCN({
          title: params.metadata.title,
          author: params.metadata.author,
          publisher: params.metadata.publisher,
          publication_date: params.metadata.publication_date,
          isbn: '', // Will be filled from Phase 1
          format: params.formats[0],
        });

        return { lccn };
      });

      // ========================================================================
      // Phase 4: Format Conversion (50%)
      // ========================================================================
      const formatOutputs: any = {};

      await this.runPhase(pipeline, 'format_conversion', async () => {
        // Convert to EPUB
        if (params.formats.includes('ebook')) {
          const epub = await this.formatConverter.convertToEPUB({
            project_id: params.project_id,
            chapters: params.chapters,
            metadata: params.metadata,
          });
          formatOutputs.epub = epub;

          // Convert EPUB to MOBI for Kindle
          const mobi = await this.formatConverter.convertToMOBI(
            epub.file,
            params.project_id
          );
          formatOutputs.mobi = mobi;
        }

        // Convert to PDF for print
        if (params.formats.includes('print')) {
          const pdf = await this.formatConverter.convertToPDF({
            project_id: params.project_id,
            chapters: params.chapters,
            metadata: params.metadata,
            trim_size: '6x9',
            include_bleed: true,
          });
          formatOutputs.pdf = pdf;
        }

        return { formats: formatOutputs };
      });

      // ========================================================================
      // Phase 5: Cover Generation (65%)
      // ========================================================================
      let coverDesign: any;

      await this.runPhase(pipeline, 'cover_generation', async () => {
        coverDesign = await this.coverDesigner.generateCover({
          project_id: params.project_id,
          title: params.metadata.title,
          subtitle: params.metadata.subtitle,
          author: params.metadata.author,
          genre: params.metadata.genre,
          trim_size: params.formats.includes('print') ? '6x9' : undefined,
          spine_width: 1, // Calculated from page count
        });

        return { cover: coverDesign };
      });

      // ========================================================================
      // Phase 6: Metadata Optimization (75%)
      // ========================================================================
      let optimizedMetadata: any;

      await this.runPhase(pipeline, 'metadata_optimization', async () => {
        optimizedMetadata = await this.metadataOptimizer.optimizeMetadata(
          params.metadata
        );

        return { metadata: optimizedMetadata };
      });

      // ========================================================================
      // Phase 7: Quality Validation (85%)
      // ========================================================================
      await this.runPhase(pipeline, 'quality_validation', async () => {
        const validations: any = {};

        // Validate EPUB
        if (formatOutputs.epub) {
          validations.epub = await this.qualityValidator.validateEPUB(
            formatOutputs.epub,
            optimizedMetadata
          );
        }

        // Validate PDF
        if (formatOutputs.pdf) {
          validations.pdf = await this.qualityValidator.validatePDF(
            formatOutputs.pdf,
            'ingram_spark'
          );
        }

        // Validate cover
        if (coverDesign) {
          validations.cover = await this.qualityValidator.validateCover(
            coverDesign,
            'amazon_kdp'
          );
        }

        // Check if any critical errors
        const hasCriticalErrors = Object.values(validations).some(
          (v: any) => !v.valid
        );

        if (hasCriticalErrors) {
          throw new Error('Quality validation failed with critical errors');
        }

        return { validations };
      });

      // ========================================================================
      // Phase 8: Platform Submissions (100%)
      // ========================================================================
      const submissions: any[] = [];

      await this.runPhase(pipeline, 'platform_submission', async () => {
        for (const channel of params.distribution_channels) {
          const publisher = this.publishers[channel];

          if (!publisher) {
            logger.warn(`No publisher available for channel: ${channel}`);
            continue;
          }

          // Prepare submission request
          const submissionRequest = {
            isbn: '', // From Phase 1
            title: optimizedMetadata.title,
            author: optimizedMetadata.author,
            description: optimizedMetadata.description,
            categories: optimizedMetadata.bisac_categories,
            keywords: optimizedMetadata.keywords,
            cover: coverDesign.front_cover,
            manuscript: formatOutputs.epub?.file || formatOutputs.pdf?.file,
            price: params.metadata.price.usd,
            territories: ['US', 'CA', 'UK', 'AU'], // Default worldwide
            drm_enabled: false,
          };

          // Submit to platform
          const submission = await publisher.submitBook(submissionRequest);
          submissions.push(submission);
        }

        return { submissions };
      });

      // ========================================================================
      // Create Publishing Project Record
      // ========================================================================
      const costs = this.calculateCosts(params);

      const project: PublishingProject = {
        id: uuidv4(),
        prose_project_id: params.project_id,
        title: params.metadata.title,
        author: params.metadata.author,
        formats: params.formats,
        distribution_channels: params.distribution_channels,
        status: 'published',
        created_at: pipeline.started_at,
        updated_at: new Date(),
        published_at: new Date(),
        total_cost: costs.total,
      };

      // Save to database
      await this.savePublishingProject(project);

      logger.info(`Publishing pipeline completed for project ${params.project_id}`);

      return project;

    } catch (error: any) {
      logger.error('Publishing pipeline failed', {
        error: error.message,
        project_id: params.project_id,
        phase: pipeline.current_phase.name,
      });

      throw new Error(`Publishing failed at ${pipeline.current_phase.name}: ${error.message}`);
    }
  }

  /**
   * Run a publishing phase with progress tracking
   */
  private async runPhase(
    pipeline: PublishingPipeline,
    phase: PublishingPhaseStatus['phase'],
    handler: () => Promise<any>
  ): Promise<any> {
    const phaseStatus: PublishingPhaseStatus = {
      phase,
      status: 'in_progress',
      progress: 0,
      started_at: new Date(),
    };

    pipeline.phases.push(phaseStatus);
    pipeline.current_phase = { name: phase, order: 0, status: 'in_progress', progress: 0 };

    // Emit progress event
    this.emit('progress', {
      type: 'progress',
      project_id: pipeline.project_id,
      phase,
      progress: this.getPhasePercentage(phase),
      message: `Starting ${phase}...`,
      timestamp: new Date(),
    });

    try {
      const result = await handler();

      phaseStatus.status = 'completed';
      phaseStatus.progress = 100;
      phaseStatus.completed_at = new Date();

      // Update overall progress
      pipeline.progress_percentage = this.getPhasePercentage(phase);

      // Emit completion event
      this.emit('progress', {
        type: 'progress',
        project_id: pipeline.project_id,
        phase,
        progress: pipeline.progress_percentage,
        message: `Completed ${phase}`,
        timestamp: new Date(),
      });

      return result;

    } catch (error: any) {
      phaseStatus.status = 'failed';
      phaseStatus.message = error.message;

      this.emit('error', {
        type: 'error',
        project_id: pipeline.project_id,
        phase,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Get percentage for each phase
   */
  private getPhasePercentage(phase: PublishingPhaseStatus['phase']): number {
    const percentages: Record<string, number> = {
      'isbn_acquisition': 10,
      'copyright_registration': 20,
      'lccn_application': 30,
      'format_conversion': 50,
      'cover_generation': 65,
      'metadata_optimization': 75,
      'quality_validation': 85,
      'platform_submission': 100,
    };

    return percentages[phase] || 0;
  }

  /**
   * Calculate total publishing costs
   */
  private calculateCosts(params: {
    formats: PublishingFormat[];
  }): CostBreakdown {
    const costs: CostBreakdown = {
      isbn_costs: params.formats.length * config.costs.isbn_single,
      copyright_costs: config.costs.copyright_registration,
      lccn_costs: config.costs.lccn,
      cover_design_costs: config.costs.cover_generation,
      format_conversion_costs: 0, // Internal, no cost
      platform_submission_costs: 0, // Varies by platform
      total: 0,
    };

    costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    return costs;
  }

  /**
   * Save publishing project to database
   */
  private async savePublishingProject(project: PublishingProject): Promise<void> {
    await this.db.query(
      `INSERT INTO prose.publishing_projects
       (id, prose_project_id, title, author, formats, distribution_channels,
        status, created_at, updated_at, published_at, total_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        project.id,
        project.prose_project_id,
        project.title,
        project.author,
        project.formats,
        project.distribution_channels,
        project.status,
        project.created_at,
        project.updated_at,
        project.published_at,
        project.total_cost,
      ]
    );
  }
}
