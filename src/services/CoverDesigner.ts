/**
 * Cover Designer Service
 *
 * AI-powered book cover generation using:
 * - OpenAI DALL-E 3 for cover art generation
 * - MageAgent for design concept development
 * - Sharp for image processing and text overlay
 */

import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import Jimp from 'jimp';
import {
  CoverDesign,
  CoverDesignRequest,
  CoverGenerationResult,
  TrimSize,
  BookMetadata,
} from '../types';
import { config, serverConfig } from '../config';
import { logger } from '../utils/logger';

export class CoverDesigner {
  private openaiClient: AxiosInstance;
  private mageagentClient: AxiosInstance;
  private db: Pool;
  private outputDir: string;

  constructor(db: Pool) {
    this.db = db;
    this.outputDir = path.join(config.storage.outputDir, 'covers');
    this.ensureOutputDir();

    // OpenAI client for DALL-E
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes for image generation
    });

    // MageAgent client for design concepts
    this.mageagentClient = axios.create({
      baseURL: serverConfig.mageagentApiUrl,
      timeout: 60000,
    });

    logger.info('CoverDesigner initialized');
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create cover output directory', { error });
    }
  }

  /**
   * Generate book cover using AI
   *
   * Process:
   * 1. Use MageAgent to develop cover concept based on genre and metadata
   * 2. Generate cover art with DALL-E 3
   * 3. Add title and author text overlay
   * 4. Generate variations (front, full wrap, thumbnail)
   */
  async generateCover(request: CoverDesignRequest): Promise<CoverGenerationResult> {
    logger.info(`Generating cover for project ${request.project_id}`);

    try {
      // Step 1: Develop cover concept using MageAgent
      const concept = await this.developCoverConcept(request);

      // Step 2: Generate cover art with DALL-E
      const coverArt = await this.generateCoverArt(concept.prompt);

      // Step 3: Add text overlay (title and author)
      const frontCover = await this.addTextOverlay(coverArt, {
        title: request.title,
        subtitle: request.subtitle,
        author: request.author,
        genre: request.genre,
      });

      // Step 4: Generate thumbnail
      const thumbnail = await this.generateThumbnail(frontCover);

      // Step 5: Generate full cover for print (if trim size provided)
      let fullCover: Buffer | undefined;
      if (request.trim_size) {
        fullCover = await this.generateFullCover({
          frontCover,
          trimSize: request.trim_size,
          spineWidth: request.spine_width || 1, // Default 1 inch
          metadata: {
            title: request.title,
            author: request.author,
          },
        });
      }

      // Step 6: Save cover design to database
      const coverId = await this.saveCoverDesign({
        project_id: request.project_id,
        front_cover: frontCover,
        full_cover: fullCover,
        thumbnail,
      });

      logger.info(`Cover generated successfully: ${coverId}`);

      return {
        concept_description: concept.description,
        ai_prompt: concept.prompt,
        front_cover: frontCover,
        full_cover: fullCover,
        thumbnail,
        design_notes: concept.design_notes,
        cost: config.costs.cover_generation,
      };

    } catch (error: any) {
      logger.error('Cover generation failed', {
        error: error.message,
        project_id: request.project_id,
      });
      throw new Error(`Cover generation failed: ${error.message}`);
    }
  }

  /**
   * Develop cover concept using MageAgent
   */
  private async developCoverConcept(request: CoverDesignRequest): Promise<{
    description: string;
    prompt: string;
    design_notes: string;
  }> {
    logger.info('Developing cover concept with MageAgent');

    try {
      const response = await this.mageagentClient.post('/orchestrate', {
        task: 'design book cover concept',
        context: {
          title: request.title,
          subtitle: request.subtitle,
          author: request.author,
          genre: request.genre,
          style_preferences: request.style_preferences || 'professional, bestseller quality',
          color_preferences: request.color_preferences,
        },
        maxAgents: 3,
      });

      const concept = response.data.results;

      return {
        description: concept.description || 'Professional book cover design',
        prompt: this.buildDALLEPrompt(request, concept),
        design_notes: concept.notes || '',
      };

    } catch (error) {
      logger.warn('MageAgent unavailable, using fallback concept');
      return {
        description: `Professional ${request.genre} book cover`,
        prompt: this.buildDALLEPrompt(request, null),
        design_notes: 'Fallback concept - MageAgent unavailable',
      };
    }
  }

  /**
   * Build DALL-E prompt for cover generation
   */
  private buildDALLEPrompt(
    request: CoverDesignRequest,
    concept: any
  ): string {
    const styleMap: Record<string, string> = {
      'fiction': 'cinematic, dramatic lighting, highly detailed',
      'romance': 'romantic, soft lighting, intimate',
      'thriller': 'dark, suspenseful, dramatic shadows',
      'fantasy': 'epic, magical, ethereal',
      'science fiction': 'futuristic, technological, cosmic',
      'mystery': 'mysterious, noir, dramatic',
      'horror': 'dark, ominous, scary',
      'non-fiction': 'clean, professional, informative',
    };

    const genreStyle = styleMap[request.genre.toLowerCase()] || 'professional, clean';

    let prompt = `Professional book cover design, ${genreStyle}. `;

    if (concept?.description) {
      prompt += `${concept.description}. `;
    } else {
      prompt += `Inspired by the title "${request.title}". `;
    }

    if (request.color_preferences && request.color_preferences.length > 0) {
      prompt += `Color scheme: ${request.color_preferences.join(', ')}. `;
    }

    prompt += 'High quality, bestseller aesthetic, no text or titles. ';
    prompt += 'Portrait orientation, suitable for book cover. ';
    prompt += '8K resolution, professional photography style.';

    return prompt;
  }

  /**
   * Generate cover art using DALL-E 3
   */
  private async generateCoverArt(prompt: string): Promise<Buffer> {
    logger.info('Generating cover art with DALL-E 3');

    try {
      const response = await this.openaiClient.post('/images/generations', {
        model: 'dall-e-3',
        prompt,
        size: '1024x1792', // Portrait for book cover
        quality: 'hd',
        n: 1,
      });

      const imageUrl = response.data.data[0].url;

      // Download generated image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      logger.info('Cover art generated successfully');

      return Buffer.from(imageResponse.data);

    } catch (error: any) {
      logger.error('DALL-E generation failed', { error: error.message });
      throw new Error(`DALL-E generation failed: ${error.message}`);
    }
  }

  /**
   * Add text overlay (title and author) to cover
   */
  private async addTextOverlay(
    coverArt: Buffer,
    text: {
      title: string;
      subtitle?: string;
      author: string;
      genre: string;
    }
  ): Promise<Buffer> {
    logger.info('Adding text overlay to cover');

    try {
      // Load cover art with Jimp
      const image = await Jimp.read(coverArt);
      const width = image.getWidth();
      const height = image.getHeight();

      // Load fonts
      const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
      const subtitleFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
      const authorFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

      // Add semi-transparent overlay for better text readability
      const overlay = new Jimp(width, height, 0x00000060); // Semi-transparent black
      image.composite(overlay, 0, 0);

      // Add title (top third)
      image.print(
        titleFont,
        50,
        height * 0.15,
        {
          text: text.title,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
        },
        width - 100,
        height * 0.3
      );

      // Add subtitle if provided
      if (text.subtitle) {
        image.print(
          subtitleFont,
          50,
          height * 0.35,
          {
            text: text.subtitle,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
          },
          width - 100,
          height * 0.2
        );
      }

      // Add author name (bottom)
      image.print(
        authorFont,
        50,
        height * 0.85,
        {
          text: text.author,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
        },
        width - 100,
        height * 0.1
      );

      const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

      // Enhance with Sharp
      const enhanced = await sharp(buffer)
        .resize(2560, 1600, { fit: 'cover' }) // Amazon KDP recommended size
        .jpeg({ quality: 95 })
        .toBuffer();

      logger.info('Text overlay added successfully');

      return enhanced;

    } catch (error: any) {
      logger.error('Text overlay failed', { error: error.message });
      throw new Error(`Text overlay failed: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail for online listings
   */
  private async generateThumbnail(cover: Buffer): Promise<Buffer> {
    return sharp(cover)
      .resize(300, 450, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Generate full cover wrap for print (front + spine + back)
   */
  private async generateFullCover(params: {
    frontCover: Buffer;
    trimSize: TrimSize;
    spineWidth: number;
    metadata: { title: string; author: string };
  }): Promise<Buffer> {
    logger.info('Generating full cover wrap for print');

    const [width, height] = this.parseTrimSize(params.trimSize);
    const spineWidthPx = params.spineWidth * 300; // Convert inches to pixels (300 DPI)
    const coverWidthPx = width * 300;
    const coverHeightPx = height * 300;

    // Total width = front + spine + back + bleed
    const bleed = 0.125 * 300; // 0.125" bleed
    const totalWidth = (coverWidthPx * 2) + spineWidthPx + (bleed * 2);
    const totalHeight = coverHeightPx + (bleed * 2);

    try {
      // Create canvas
      const canvas = sharp({
        create: {
          width: Math.round(totalWidth),
          height: Math.round(totalHeight),
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      });

      // Resize front cover
      const frontResized = await sharp(params.frontCover)
        .resize(Math.round(coverWidthPx), Math.round(coverHeightPx), { fit: 'cover' })
        .toBuffer();

      // For now, use same image for back cover (mirrored)
      const backResized = await sharp(params.frontCover)
        .resize(Math.round(coverWidthPx), Math.round(coverHeightPx), { fit: 'cover' })
        .flop() // Mirror horizontally
        .toBuffer();

      // Composite all parts
      const fullCover = await canvas
        .composite([
          { input: backResized, left: Math.round(bleed), top: Math.round(bleed) },
          { input: frontResized, left: Math.round(coverWidthPx + spineWidthPx + bleed), top: Math.round(bleed) },
        ])
        .jpeg({ quality: 100 })
        .toBuffer();

      logger.info('Full cover wrap generated successfully');

      return fullCover;

    } catch (error: any) {
      logger.error('Full cover generation failed', { error: error.message });
      throw new Error(`Full cover generation failed: ${error.message}`);
    }
  }

  /**
   * Save cover design to database
   */
  private async saveCoverDesign(params: {
    project_id: string;
    front_cover: Buffer;
    full_cover?: Buffer;
    thumbnail: Buffer;
  }): Promise<string> {
    const coverId = uuidv4();

    // Save files to disk
    const frontPath = path.join(this.outputDir, `${coverId}_front.jpg`);
    const thumbPath = path.join(this.outputDir, `${coverId}_thumb.jpg`);

    await fs.writeFile(frontPath, params.front_cover);
    await fs.writeFile(thumbPath, params.thumbnail);

    let fullPath: string | null = null;
    if (params.full_cover) {
      fullPath = path.join(this.outputDir, `${coverId}_full.jpg`);
      await fs.writeFile(fullPath, params.full_cover);
    }

    // Store in database
    await this.db.query(
      `INSERT INTO prose.cover_designs
       (id, project_id, front_cover_path, full_cover_path, thumbnail_path,
        dimensions_width, dimensions_height, format, dpi, color_mode, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        coverId,
        params.project_id,
        frontPath,
        fullPath,
        thumbPath,
        2560,
        1600,
        'jpg',
        300,
        'RGB',
        new Date(),
      ]
    );

    return coverId;
  }

  /**
   * Get cover by project ID
   */
  async getCoverByProject(projectId: string): Promise<CoverDesign | null> {
    const result = await this.db.query(
      `SELECT * FROM prose.cover_designs WHERE project_id = $1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Load files
    const frontCover = await fs.readFile(row.front_cover_path);
    const thumbnail = await fs.readFile(row.thumbnail_path);
    let fullCover: Buffer | undefined;
    if (row.full_cover_path) {
      fullCover = await fs.readFile(row.full_cover_path);
    }

    return {
      id: row.id,
      project_id: row.project_id,
      front_cover: frontCover,
      full_cover: fullCover,
      thumbnail,
      dimensions: {
        width: row.dimensions_width,
        height: row.dimensions_height,
      },
      format: row.format,
      dpi: row.dpi,
      color_mode: row.color_mode,
      created_at: row.created_at,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private parseTrimSize(trimSize: TrimSize): [number, number] {
    const [width, height] = trimSize.split('x').map(parseFloat);
    return [width, height];
  }

  private selectFont(genre: string): string {
    const fontMap: Record<string, string> = {
      'fiction': 'Georgia',
      'romance': 'Palatino',
      'thriller': 'Impact',
      'fantasy': 'Celtic',
      'science fiction': 'Futura',
      'mystery': 'Times New Roman',
      'horror': 'Gothic',
      'non-fiction': 'Helvetica',
    };

    return fontMap[genre.toLowerCase()] || 'Georgia';
  }
}
