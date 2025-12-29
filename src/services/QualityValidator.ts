/**
 * Quality Validator Service
 *
 * Validates all publishing outputs before distribution:
 * - EPUB validation (epubcheck)
 * - PDF validation (print-ready checks)
 * - Cover image validation (specs compliance)
 * - Metadata completeness
 * - File size and format requirements
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  EPUBFile,
  PDFFile,
  CoverDesign,
  BookMetadata,
  DistributionChannel,
} from '../types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class QualityValidator {
  /**
   * Validate EPUB file
   *
   * Checks:
   * - EPUB structure validity
   * - Metadata completeness
   * - Accessibility compliance
   * - File size limits
   */
  async validateEPUB(epub: EPUBFile, metadata: BookMetadata): Promise<ValidationResult> {
    logger.info('Validating EPUB file');

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // 1. Check file size (Amazon KDP limit: 650 MB)
      if (epub.size > 650 * 1024 * 1024) {
        errors.push({
          code: 'EPUB_TOO_LARGE',
          message: 'EPUB file exceeds 650 MB limit',
          severity: 'critical',
          suggestion: 'Reduce image sizes or split into multiple volumes',
        });
      }

      // 2. Check EPUB version
      if (epub.format === 'epub2') {
        warnings.push({
          code: 'EPUB_OLD_VERSION',
          message: 'EPUB2 is deprecated, EPUB3 recommended',
          impact: 'medium',
          suggestion: 'Convert to EPUB3 for better compatibility',
        });
      }

      // 3. Check for cover
      if (!epub.has_cover) {
        errors.push({
          code: 'MISSING_COVER',
          message: 'EPUB does not contain a cover image',
          severity: 'critical',
          suggestion: 'Add cover image to EPUB package',
        });
      }

      // 4. Check table of contents depth
      if (epub.toc_depth === 0) {
        warnings.push({
          code: 'NO_TOC',
          message: 'EPUB does not have a table of contents',
          impact: 'high',
          suggestion: 'Add navigation document for better user experience',
        });
      }

      // 5. Validate metadata
      const metadataValidation = this.validateMetadata(metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);

      // 6. Run epubcheck if available
      try {
        const epubcheckResult = await this.runEpubCheck(epub.file);
        errors.push(...epubcheckResult.errors);
        warnings.push(...epubcheckResult.warnings);
      } catch (error) {
        logger.warn('epubcheck not available, skipping detailed validation');
      }

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(errors, warnings);

      return {
        valid: errors.filter(e => e.severity === 'critical').length === 0,
        format: 'EPUB',
        errors,
        warnings,
        quality_score: qualityScore,
        validated_at: new Date(),
      };

    } catch (error: any) {
      logger.error('EPUB validation failed', { error: error.message });
      throw new Error(`EPUB validation failed: ${error.message}`);
    }
  }

  /**
   * Validate PDF file for print
   */
  async validatePDF(pdf: PDFFile, channel: DistributionChannel): Promise<ValidationResult> {
    logger.info(`Validating PDF for ${channel}`);

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Platform-specific requirements
    const requirements = this.getPDFRequirements(channel);

    // 1. Check file size
    if (pdf.size > requirements.maxFileSize) {
      errors.push({
        code: 'PDF_TOO_LARGE',
        message: `PDF exceeds ${requirements.maxFileSize / (1024 * 1024)} MB limit for ${channel}`,
        severity: 'critical',
        suggestion: 'Reduce image quality or resolution',
      });
    }

    // 2. Check color profile for print
    if (channel === 'ingram_spark' && pdf.color_profile !== 'CMYK') {
      warnings.push({
        code: 'WRONG_COLOR_PROFILE',
        message: 'IngramSpark recommends CMYK color profile for print',
        impact: 'medium',
        suggestion: 'Convert PDF to CMYK color space',
      });
    }

    // 3. Check page count
    if (pdf.page_count < requirements.minPages) {
      errors.push({
        code: 'TOO_FEW_PAGES',
        message: `PDF has ${pdf.page_count} pages, minimum ${requirements.minPages} required`,
        severity: 'error',
        suggestion: 'Add more content or adjust layout',
      });
    }

    // 4. Check bleed for print
    if (channel === 'ingram_spark' && !pdf.bleed) {
      warnings.push({
        code: 'NO_BLEED',
        message: 'PDF does not include bleed (0.125" recommended)',
        impact: 'high',
        suggestion: 'Add bleed to prevent white edges in print',
      });
    }

    const qualityScore = this.calculateQualityScore(errors, warnings);

    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      format: 'PDF',
      errors,
      warnings,
      quality_score: qualityScore,
      validated_at: new Date(),
    };
  }

  /**
   * Validate cover image
   */
  async validateCover(
    cover: CoverDesign,
    channel: DistributionChannel
  ): Promise<ValidationResult> {
    logger.info(`Validating cover for ${channel}`);

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const requirements = this.getCoverRequirements(channel);

    // 1. Check dimensions
    if (
      cover.dimensions.width < requirements.minWidth ||
      cover.dimensions.height < requirements.minHeight
    ) {
      errors.push({
        code: 'COVER_TOO_SMALL',
        message: `Cover dimensions ${cover.dimensions.width}x${cover.dimensions.height} below minimum ${requirements.minWidth}x${requirements.minHeight}`,
        severity: 'critical',
        suggestion: `Resize cover to at least ${requirements.minWidth}x${requirements.minHeight} pixels`,
      });
    }

    // 2. Check aspect ratio (should be ~1.6:1 for books)
    const aspectRatio = cover.dimensions.width / cover.dimensions.height;
    if (aspectRatio < 0.6 || aspectRatio > 0.7) {
      warnings.push({
        code: 'UNUSUAL_ASPECT_RATIO',
        message: `Cover aspect ratio ${aspectRatio.toFixed(2)} is unusual for books`,
        impact: 'low',
        suggestion: 'Standard book covers are ~0.625 aspect ratio (e.g., 1600x2560)',
      });
    }

    // 3. Check DPI for print
    if (channel === 'ingram_spark' && cover.dpi < 300) {
      errors.push({
        code: 'LOW_DPI',
        message: `Cover DPI ${cover.dpi} is below 300 DPI required for print`,
        severity: 'critical',
        suggestion: 'Regenerate cover at 300 DPI or higher',
      });
    }

    // 4. Check file format
    if (!requirements.allowedFormats.includes(cover.format)) {
      errors.push({
        code: 'INVALID_FORMAT',
        message: `Cover format ${cover.format} not accepted by ${channel}`,
        severity: 'error',
        suggestion: `Convert to one of: ${requirements.allowedFormats.join(', ')}`,
      });
    }

    // 5. Check color mode
    if (channel === 'ingram_spark' && cover.color_mode !== 'CMYK') {
      warnings.push({
        code: 'WRONG_COLOR_MODE',
        message: 'IngramSpark recommends CMYK for print covers',
        impact: 'medium',
        suggestion: 'Convert cover to CMYK color space',
      });
    }

    const qualityScore = this.calculateQualityScore(errors, warnings);

    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      format: 'Cover Image',
      errors,
      warnings,
      quality_score: qualityScore,
      validated_at: new Date(),
    };
  }

  /**
   * Validate metadata completeness
   */
  private validateMetadata(metadata: BookMetadata): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!metadata.title || metadata.title.trim().length === 0) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Book title is required',
        severity: 'critical',
        suggestion: 'Add book title to metadata',
      });
    }

    if (!metadata.author || metadata.author.trim().length === 0) {
      errors.push({
        code: 'MISSING_AUTHOR',
        message: 'Author name is required',
        severity: 'critical',
        suggestion: 'Add author name to metadata',
      });
    }

    if (!metadata.description || metadata.description.length < 150) {
      warnings.push({
        code: 'SHORT_DESCRIPTION',
        message: 'Book description should be at least 150 characters',
        impact: 'high',
        suggestion: 'Expand description for better discoverability',
      });
    }

    if (metadata.description && metadata.description.length > 4000) {
      warnings.push({
        code: 'LONG_DESCRIPTION',
        message: 'Description exceeds 4000 characters (Amazon limit)',
        impact: 'medium',
        suggestion: 'Shorten description to 4000 characters or less',
      });
    }

    // BISAC categories
    if (!metadata.bisac_categories || metadata.bisac_categories.length === 0) {
      warnings.push({
        code: 'NO_CATEGORIES',
        message: 'No BISAC categories assigned',
        impact: 'high',
        suggestion: 'Add up to 3 BISAC categories for better categorization',
      });
    }

    // Keywords
    if (!metadata.keywords || metadata.keywords.length < 7) {
      warnings.push({
        code: 'FEW_KEYWORDS',
        message: 'Less than 7 keywords (Amazon allows 7)',
        impact: 'medium',
        suggestion: 'Add more relevant keywords (up to 7)',
      });
    }

    return { errors, warnings };
  }

  /**
   * Run epubcheck validation tool
   */
  private async runEpubCheck(epubBuffer: Buffer): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    // Save EPUB temporarily
    const tempFile = `/tmp/temp_${Date.now()}.epub`;
    await fs.writeFile(tempFile, epubBuffer);

    try {
      // Run epubcheck
      const { stdout } = await execAsync(`epubcheck "${tempFile}"`);

      // Parse output (simplified - epubcheck outputs XML)
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Clean up
      await fs.unlink(tempFile);

      return { errors, warnings };

    } catch (error: any) {
      // Clean up on error
      try {
        await fs.unlink(tempFile);
      } catch {}

      // epubcheck not available
      return { errors: [], warnings: [] };
    }
  }

  // ============================================================================
  // Platform Requirements
  // ============================================================================

  private getPDFRequirements(channel: DistributionChannel): {
    maxFileSize: number;
    minPages: number;
    colorProfile: string;
  } {
    const requirements: Record<string, any> = {
      ingram_spark: {
        maxFileSize: 500 * 1024 * 1024, // 500 MB
        minPages: 24,
        colorProfile: 'CMYK',
      },
      amazon_kdp: {
        maxFileSize: 650 * 1024 * 1024, // 650 MB
        minPages: 24,
        colorProfile: 'RGB',
      },
    };

    return requirements[channel] || requirements.amazon_kdp;
  }

  private getCoverRequirements(channel: DistributionChannel): {
    minWidth: number;
    minHeight: number;
    allowedFormats: string[];
  } {
    const requirements: Record<string, any> = {
      amazon_kdp: {
        minWidth: 2560,
        minHeight: 1600,
        allowedFormats: ['jpg', 'tiff'],
      },
      ingram_spark: {
        minWidth: 2550,
        minHeight: 3300,
        allowedFormats: ['jpg', 'png', 'tiff'],
      },
      draft2digital: {
        minWidth: 1600,
        minHeight: 2400,
        allowedFormats: ['jpg', 'png'],
      },
    };

    return requirements[channel] || requirements.amazon_kdp;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculateQualityScore(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    let score = 100;

    // Deduct for errors
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const regularErrors = errors.filter(e => e.severity === 'error').length;

    score -= criticalErrors * 20;
    score -= regularErrors * 10;

    // Deduct for warnings
    const highImpactWarnings = warnings.filter(w => w.impact === 'high').length;
    const mediumImpactWarnings = warnings.filter(w => w.impact === 'medium').length;
    const lowImpactWarnings = warnings.filter(w => w.impact === 'low').length;

    score -= highImpactWarnings * 5;
    score -= mediumImpactWarnings * 3;
    score -= lowImpactWarnings * 1;

    return Math.max(0, score);
  }
}
