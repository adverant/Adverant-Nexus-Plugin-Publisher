/**
 * Metadata Optimizer Service
 *
 * Optimizes book metadata for maximum discoverability:
 * - SEO-optimized descriptions
 * - BISAC category selection (up to 3)
 * - Keyword research and optimization (7 keywords for Amazon)
 * - Search term generation
 * - Competitive analysis
 */

import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import {
  BookMetadata,
  OptimizedMetadata,
} from '../types';
import { serverConfig } from '../config';
import { logger } from '../utils/logger';

export class MetadataOptimizer {
  private learningAgentClient: AxiosInstance;
  private db: Pool;

  // BISAC Categories Database (subset - full list has 3,000+ categories)
  private readonly BISAC_CATEGORIES: Record<string, string[]> = {
    'fiction': [
      'FIC000000 - FICTION / General',
      'FIC002000 - FICTION / Action & Adventure',
      'FIC009000 - FICTION / Fantasy / General',
      'FIC028000 - FICTION / Science Fiction / General',
      'FIC030000 - FICTION / Thriller / General',
      'FIC027000 - FICTION / Romance / General',
      'FIC022000 - FICTION / Mystery & Detective / General',
      'FIC015000 - FICTION / Horror',
    ],
    'non-fiction': [
      'BUS000000 - BUSINESS & ECONOMICS / General',
      'SEL000000 - SELF-HELP / General',
      'HIS000000 - HISTORY / General',
      'BIO000000 - BIOGRAPHY & AUTOBIOGRAPHY / General',
      'SCI000000 - SCIENCE / General',
      'POL000000 - POLITICAL SCIENCE / General',
    ],
  };

  constructor(db: Pool) {
    this.db = db;

    // LearningAgent client for keyword research
    this.learningAgentClient = axios.create({
      baseURL: serverConfig.learningAgentApiUrl,
      timeout: 60000,
    });

    logger.info('MetadataOptimizer initialized');
  }

  /**
   * Optimize book metadata for discoverability
   *
   * Performs:
   * 1. Description optimization (SEO)
   * 2. BISAC category selection
   * 3. Keyword research and selection
   * 4. Search term generation
   * 5. Competitive analysis
   */
  async optimizeMetadata(metadata: BookMetadata): Promise<OptimizedMetadata> {
    logger.info(`Optimizing metadata for: ${metadata.title}`);

    try {
      // 1. Optimize description for SEO
      const optimizedDesc = await this.optimizeDescription(metadata);

      // 2. Select best BISAC categories
      const categories = await this.selectBISACCategories(metadata);

      // 3. Research and generate keywords
      const keywords = await this.generateKeywords(metadata);

      // 4. Generate search terms
      const searchTerms = await this.generateSearchTerms(metadata);

      // 5. Optimize title/subtitle
      const titleOptimization = await this.optimizeTitle(metadata);

      // 6. Analyze keyword competitiveness
      const keywordAnalysis = await this.analyzeKeywords(keywords);

      // 7. Calculate SEO score
      const seoScore = this.calculateSEOScore({
        description: optimizedDesc,
        categories,
        keywords,
        searchTerms,
      });

      const optimized: OptimizedMetadata = {
        ...metadata,
        title: titleOptimization.title,
        subtitle: titleOptimization.subtitle,
        description: optimizedDesc,
        bisac_categories: categories,
        keywords,
        search_terms: searchTerms,
        seo_score: seoScore,
        category_competitiveness: await this.analyzeCategoryCompetitiveness(categories),
        keyword_analysis: keywordAnalysis,
      };

      logger.info(`Metadata optimized successfully, SEO score: ${seoScore}`);

      return optimized;

    } catch (error: any) {
      logger.error('Metadata optimization failed', {
        error: error.message,
        title: metadata.title,
      });
      throw new Error(`Metadata optimization failed: ${error.message}`);
    }
  }

  /**
   * Optimize book description for SEO
   */
  private async optimizeDescription(metadata: BookMetadata): Promise<string> {
    const description = metadata.description;

    // Basic optimization rules:
    // 1. First 150 characters are critical (Amazon truncates at ~150)
    // 2. Include main keywords in first paragraph
    // 3. Use compelling hook in opening
    // 4. Include genre/subgenre mentions
    // 5. End with call-to-action

    // Extract key elements
    const hook = description.split('.')[0]; // First sentence as hook
    const mainKeywords = await this.extractMainKeywords(description, metadata.genre);

    // Build optimized description
    let optimized = `${hook}. `;

    // Add keyword-rich second sentence
    optimized += `A gripping ${metadata.genre} story that combines ${mainKeywords.slice(0, 3).join(', ')}. `;

    // Add rest of original description
    const restOfDescription = description
      .split('.')
      .slice(1)
      .join('.')
      .trim();

    optimized += restOfDescription;

    // Ensure length is optimal (300-4000 characters for Amazon)
    if (optimized.length < 300) {
      optimized += ` Perfect for fans of ${metadata.genre} fiction.`;
    }

    if (optimized.length > 4000) {
      optimized = optimized.substring(0, 3997) + '...';
    }

    return optimized;
  }

  /**
   * Select up to 3 BISAC categories for the book
   */
  private async selectBISACCategories(metadata: BookMetadata): Promise<string[]> {
    const genre = metadata.genre.toLowerCase();
    const subgenres = metadata.subgenres.map(s => s.toLowerCase());

    // Determine fiction vs non-fiction
    const isFiction = genre.includes('fiction') ||
      ['romance', 'thriller', 'mystery', 'fantasy', 'science fiction'].includes(genre);

    const categoryList = isFiction
      ? this.BISAC_CATEGORIES['fiction']
      : this.BISAC_CATEGORIES['non-fiction'];

    const selectedCategories: string[] = [];

    // Primary category (exact genre match)
    const primary = categoryList.find(cat =>
      cat.toLowerCase().includes(genre.toLowerCase())
    );
    if (primary) {
      selectedCategories.push(primary);
    }

    // Secondary categories (subgenre matches)
    for (const subgenre of subgenres) {
      if (selectedCategories.length >= 3) break;

      const secondary = categoryList.find(cat =>
        cat.toLowerCase().includes(subgenre) &&
        !selectedCategories.includes(cat)
      );

      if (secondary) {
        selectedCategories.push(secondary);
      }
    }

    // Fill remaining slots with general categories
    while (selectedCategories.length < 3 && selectedCategories.length < categoryList.length) {
      const general = categoryList.find(cat => !selectedCategories.includes(cat));
      if (general) {
        selectedCategories.push(general);
      } else {
        break;
      }
    }

    return selectedCategories;
  }

  /**
   * Generate 7 keywords for Amazon KDP
   */
  private async generateKeywords(metadata: BookMetadata): Promise<string[]> {
    logger.info('Researching keywords for genre:', metadata.genre);

    try {
      // Use LearningAgent to research trending keywords
      const research = await this.learningAgentClient.post('/research', {
        topic: `trending keywords for ${metadata.genre} books in ${new Date().getFullYear()}`,
        depth: 'quick',
      });

      const trendingKeywords = research.data.keywords || [];

      // Combine with book-specific keywords
      const bookKeywords = [
        ...this.extractMainKeywords(metadata.description, metadata.genre),
        ...metadata.subgenres,
        ...trendingKeywords.slice(0, 3),
      ];

      // Remove duplicates and select top 7
      const uniqueKeywords = [...new Set(bookKeywords)];
      return uniqueKeywords.slice(0, 7);

    } catch (error) {
      logger.warn('LearningAgent unavailable, using fallback keywords');
      return this.generateFallbackKeywords(metadata);
    }
  }

  /**
   * Generate search terms for book discovery
   */
  private async generateSearchTerms(metadata: BookMetadata): Promise<string[]> {
    const terms = new Set<string>();

    // Add genre and subgenres
    terms.add(metadata.genre);
    metadata.subgenres.forEach(sg => terms.add(sg));

    // Add author name
    terms.add(metadata.author);

    // Add title words (significant words only)
    const titleWords = metadata.title
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 3 && !['the', 'and', 'for'].includes(word));
    titleWords.forEach(word => terms.add(word));

    // Add keywords
    metadata.keywords?.forEach(kw => terms.add(kw));

    // Add series name if applicable
    if (metadata.series) {
      terms.add(metadata.series.name);
    }

    return Array.from(terms);
  }

  /**
   * Optimize title and subtitle for search
   */
  private async optimizeTitle(metadata: BookMetadata): Promise<{
    title: string;
    subtitle?: string;
  }> {
    // Titles should be:
    // 1. Memorable and unique
    // 2. Include genre indicators if possible
    // 3. Under 60 characters for optimal display

    let title = metadata.title;
    let subtitle = metadata.subtitle;

    // If title is too long, consider moving part to subtitle
    if (title.length > 60 && !subtitle) {
      const parts = title.split(':');
      if (parts.length === 2) {
        title = parts[0].trim();
        subtitle = parts[1].trim();
      }
    }

    return { title, subtitle };
  }

  /**
   * Analyze keyword competitiveness
   */
  private async analyzeKeywords(keywords: string[]): Promise<Array<{
    keyword: string;
    search_volume: number;
    competition: number;
    relevance: number;
  }>> {
    // Mock analysis - in production, integrate with keyword research tools
    return keywords.map(keyword => ({
      keyword,
      search_volume: Math.floor(Math.random() * 10000) + 100,
      competition: Math.random(),
      relevance: 0.7 + Math.random() * 0.3,
    }));
  }

  /**
   * Analyze BISAC category competitiveness
   */
  private async analyzeCategoryCompetitiveness(categories: string[]): Promise<Array<{
    category: string;
    difficulty: 'low' | 'medium' | 'high';
    monthly_searches: number;
  }>> {
    // Mock analysis - in production, integrate with market research tools
    return categories.map(category => ({
      category,
      difficulty: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
      monthly_searches: Math.floor(Math.random() * 50000) + 1000,
    }));
  }

  /**
   * Calculate overall SEO score (0-100)
   */
  private calculateSEOScore(data: {
    description: string;
    categories: string[];
    keywords: string[];
    searchTerms: string[];
  }): number {
    let score = 0;

    // Description score (30 points)
    if (data.description.length >= 300 && data.description.length <= 4000) {
      score += 30;
    } else if (data.description.length >= 150) {
      score += 20;
    } else {
      score += 10;
    }

    // Category score (25 points)
    score += (data.categories.length / 3) * 25;

    // Keyword score (25 points)
    score += (data.keywords.length / 7) * 25;

    // Search term score (20 points)
    score += Math.min((data.searchTerms.length / 15) * 20, 20);

    return Math.round(score);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractMainKeywords(text: string, genre: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);

    const keywords = words
      .filter(word => word.length > 4 && !stopWords.has(word))
      .filter((word, index, self) => self.indexOf(word) === index) // unique
      .slice(0, 10);

    return [genre, ...keywords];
  }

  private generateFallbackKeywords(metadata: BookMetadata): string[] {
    return [
      metadata.genre,
      ...metadata.subgenres,
      `${metadata.genre} books`,
      `${metadata.genre} fiction`,
      'bestseller',
      'new release',
      metadata.author.split(' ').pop() || metadata.author, // Last name
    ].slice(0, 7);
  }
}
