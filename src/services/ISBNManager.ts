/**
 * ISBN Management Service - Bowker API Integration
 *
 * Handles ISBN purchase, assignment, and metadata registration
 * with Bowker's MyIdentifiers and Books In Print systems.
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import {
  ISBN,
  ISBNPurchaseRequest,
  AssignedISBN,
  BookMetadata,
  PublishingFormat,
  ContactInfo,
} from '../types';
import { config, serverConfig } from '../config';
import { logger } from '../utils/logger';

export class ISBNManager {
  private bowkerClient: AxiosInstance;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
    this.bowkerClient = axios.create({
      baseURL: 'https://api.bowker.com/v2',
      headers: {
        'Authorization': `Bearer ${config.bowker.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info('ISBNManager initialized');
  }

  /**
   * Purchase ISBNs from Bowker
   *
   * Pricing:
   * - 1 ISBN: $125
   * - 10 ISBNs: $295 ($29.50 each)
   * - 100 ISBNs: $1,500 ($15 each)
   */
  async purchaseISBN(request: ISBNPurchaseRequest): Promise<ISBN[]> {
    logger.info(`Purchasing ${request.quantity} ISBN(s) from Bowker`);

    try {
      // Calculate cost
      const cost = this.calculateISBNCost(request.quantity);

      // Call Bowker API
      const response = await this.bowkerClient.post('/isbn/purchase', {
        quantity: request.quantity,
        publisher: request.publisher_name,
        contact: request.contact_info,
        account_id: config.bowker.accountId,
      });

      const isbns: ISBN[] = [];

      // Store each ISBN in database
      for (const isbnData of response.data.isbns) {
        const isbn: ISBN = {
          id: uuidv4(),
          isbn_13: isbnData.isbn13,
          isbn_10: isbnData.isbn10,
          project_id: null,
          format_type: 'ebook', // Default, can be changed on assignment
          status: 'available',
          purchased_at: new Date(),
          assigned_at: null,
          published_at: null,
          cost: cost / request.quantity, // Cost per ISBN
        };

        await this.db.query(
          `INSERT INTO prose.isbns
           (id, isbn_13, isbn_10, project_id, format_type, status, purchased_at, assigned_at, published_at, cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            isbn.id,
            isbn.isbn_13,
            isbn.isbn_10,
            isbn.project_id,
            isbn.format_type,
            isbn.status,
            isbn.purchased_at,
            isbn.assigned_at,
            isbn.published_at,
            isbn.cost,
          ]
        );

        isbns.push(isbn);
      }

      logger.info(`Successfully purchased ${isbns.length} ISBN(s), total cost: $${cost}`);
      return isbns;

    } catch (error: any) {
      logger.error('Failed to purchase ISBNs from Bowker', {
        error: error.message,
        response: error.response?.data,
      });

      // If Bowker API is unavailable, generate placeholder ISBNs for development
      if (serverConfig.nodeEnv === 'development') {
        logger.warn('Bowker API unavailable, generating placeholder ISBNs for development');
        return this.generatePlaceholderISBNs(request.quantity);
      }

      throw new Error(`Failed to purchase ISBNs: ${error.message}`);
    }
  }

  /**
   * Assign an ISBN to a project for a specific format
   */
  async assignISBN(params: {
    project_id: string;
    format: PublishingFormat;
  }): Promise<AssignedISBN> {
    logger.info(`Assigning ISBN for project ${params.project_id}, format: ${params.format}`);

    // Get available ISBN from pool (prefer matching format type)
    const result = await this.db.query(
      `SELECT * FROM prose.isbns
       WHERE status = $1
       AND (format_type = $2 OR format_type IS NULL)
       ORDER BY CASE WHEN format_type = $2 THEN 0 ELSE 1 END, purchased_at ASC
       LIMIT 1`,
      ['available', params.format]
    );

    if (result.rows.length === 0) {
      throw new Error(
        'No available ISBNs. Please purchase more ISBNs before publishing.'
      );
    }

    const isbn = result.rows[0];

    // Assign to project
    await this.db.query(
      `UPDATE prose.isbns
       SET project_id = $1, status = $2, format_type = $3, assigned_at = $4
       WHERE id = $5`,
      [params.project_id, 'assigned', params.format, new Date(), isbn.id]
    );

    logger.info(`ISBN ${isbn.isbn_13} assigned to project ${params.project_id}`);

    // Generate barcode image (optional)
    const barcodeImage = await this.generateBarcode(isbn.isbn_13);

    return {
      isbn_13: isbn.isbn_13,
      isbn_10: isbn.isbn_10,
      format: params.format,
      barcode_image: barcodeImage,
    };
  }

  /**
   * Register book metadata with Bowker's Books In Print
   */
  async registerMetadata(isbn: string, metadata: BookMetadata): Promise<void> {
    logger.info(`Registering metadata for ISBN ${isbn}`);

    try {
      await this.bowkerClient.put(`/isbn/${isbn}/metadata`, {
        title: metadata.title,
        subtitle: metadata.subtitle,
        author: metadata.author,
        co_authors: metadata.co_authors,
        publisher: metadata.publisher,
        publication_date: metadata.publication_date,
        language: metadata.language,
        page_count: metadata.page_count,
        description: metadata.description,
        bisac_codes: metadata.bisac_categories,
        price: metadata.price.usd,
        format: this.mapFormatToBowker(isbn),
      });

      logger.info(`Metadata registered successfully for ISBN ${isbn}`);

    } catch (error: any) {
      logger.error(`Failed to register metadata for ISBN ${isbn}`, {
        error: error.message,
      });
      // Don't throw - metadata registration is supplementary
    }
  }

  /**
   * Get available ISBNs
   */
  async getAvailableISBNs(): Promise<ISBN[]> {
    const result = await this.db.query(
      `SELECT * FROM prose.isbns WHERE status = $1 ORDER BY purchased_at DESC`,
      ['available']
    );

    return result.rows;
  }

  /**
   * Get ISBN by project ID
   */
  async getISBNByProject(projectId: string): Promise<ISBN[]> {
    const result = await this.db.query(
      `SELECT * FROM prose.isbns WHERE project_id = $1`,
      [projectId]
    );

    return result.rows;
  }

  /**
   * Mark ISBN as published
   */
  async markAsPublished(isbn: string): Promise<void> {
    await this.db.query(
      `UPDATE prose.isbns SET status = $1, published_at = $2 WHERE isbn_13 = $3`,
      ['published', new Date(), isbn]
    );

    logger.info(`ISBN ${isbn} marked as published`);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private calculateISBNCost(quantity: 1 | 10 | 100): number {
    switch (quantity) {
      case 1:
        return config.costs.isbn_single;
      case 10:
        return config.costs.isbn_10pack;
      case 100:
        return config.costs.isbn_100pack;
      default:
        throw new Error(`Invalid ISBN quantity: ${quantity}`);
    }
  }

  private async generateBarcode(isbn: string): Promise<Buffer | undefined> {
    try {
      // Use Bowker's barcode generation service or external service
      const response = await this.bowkerClient.get(`/isbn/${isbn}/barcode`, {
        responseType: 'arraybuffer',
        params: {
          format: 'png',
          width: 300,
          height: 150,
        },
      });

      return Buffer.from(response.data);

    } catch (error) {
      logger.warn(`Failed to generate barcode for ISBN ${isbn}`);
      return undefined;
    }
  }

  private async mapFormatToBowker(isbn: string): Promise<string> {
    const result = await this.db.query(
      `SELECT format_type FROM prose.isbns WHERE isbn_13 = $1`,
      [isbn]
    );

    if (result.rows.length === 0) {
      return 'Digital';
    }

    const format = result.rows[0].format_type;
    switch (format) {
      case 'ebook':
        return 'Digital';
      case 'print':
        return 'Print';
      case 'audiobook':
        return 'Audio';
      default:
        return 'Digital';
    }
  }

  /**
   * Generate placeholder ISBNs for development/testing
   */
  private async generatePlaceholderISBNs(quantity: number): Promise<ISBN[]> {
    const isbns: ISBN[] = [];
    const cost = this.calculateISBNCost(quantity as 1 | 10 | 100);

    for (let i = 0; i < quantity; i++) {
      // Generate valid-looking ISBN-13 (978 prefix + random digits)
      const randomDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
      const isbn13 = `978${randomDigits}`;

      // Calculate check digit
      let sum = 0;
      for (let j = 0; j < 12; j++) {
        sum += parseInt(isbn13[j]) * (j % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const finalIsbn13 = isbn13 + checkDigit;

      const isbn: ISBN = {
        id: uuidv4(),
        isbn_13: finalIsbn13,
        isbn_10: '', // Not generating ISBN-10 for placeholders
        project_id: null,
        format_type: 'ebook',
        status: 'available',
        purchased_at: new Date(),
        assigned_at: null,
        published_at: null,
        cost: cost / quantity,
      };

      await this.db.query(
        `INSERT INTO prose.isbns
         (id, isbn_13, isbn_10, project_id, format_type, status, purchased_at, assigned_at, published_at, cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          isbn.id,
          isbn.isbn_13,
          isbn.isbn_10,
          isbn.project_id,
          isbn.format_type,
          isbn.status,
          isbn.purchased_at,
          isbn.assigned_at,
          isbn.published_at,
          isbn.cost,
        ]
      );

      isbns.push(isbn);
    }

    logger.info(`Generated ${isbns.length} placeholder ISBN(s) for development`);
    return isbns;
  }
}
