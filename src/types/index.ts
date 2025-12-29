/**
 * Core type definitions for NexusProseCreator Publisher Service
 */

// ============================================================================
// Publishing Formats
// ============================================================================

export type PublishingFormat = 'ebook' | 'print' | 'audiobook';
export type EbookFormat = 'epub' | 'mobi' | 'azw3' | 'pdf';
export type PrintFormat = 'paperback' | 'hardcover';
export type TrimSize = '5x8' | '5.5x8.5' | '6x9' | '7x10' | '8x10' | '8.5x11';

// ============================================================================
// ISBN Management
// ============================================================================

export interface ISBN {
  id: string;
  isbn_13: string;
  isbn_10: string;
  project_id: string | null;
  format_type: PublishingFormat;
  status: 'available' | 'assigned' | 'published';
  purchased_at: Date;
  assigned_at: Date | null;
  published_at: Date | null;
  cost: number;
}

export interface ISBNPurchaseRequest {
  quantity: 1 | 10 | 100;
  publisher_name: string;
  contact_info: ContactInfo;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface AssignedISBN {
  isbn_13: string;
  isbn_10: string;
  format: PublishingFormat;
  barcode_image?: Buffer;
}

// ============================================================================
// Copyright Registration
// ============================================================================

export interface CopyrightRegistration {
  id: string;
  project_id: string;
  registration_id: string | null;
  title: string;
  author: string;
  form_data: FormTX;
  deposit_copy: string; // File path
  status: 'pending' | 'submitted' | 'registered' | 'rejected';
  filing_date: Date;
  registration_date: Date | null;
  registration_number: string | null;
  cost: number;
}

export interface FormTX {
  form_type: 'TX';
  title_of_work: string;
  author: {
    name: string;
    citizenship: string;
    domicile: string;
    birth_year?: number;
    death_year?: number;
  };
  claimant: string;
  year_of_completion: number;
  publication: {
    published: boolean;
    date?: Date;
    nation?: string;
  };
  rights_limitation?: string;
  previous_registration?: string;
}

export interface CopyrightSubmissionInstructions {
  registration_id: string;
  form_download_url: string;
  deposit_copy_path: string;
  submission_url: string;
  payment_amount: number;
  estimated_completion: Date;
  steps: string[];
}

// ============================================================================
// LCCN (Library of Congress Control Number)
// ============================================================================

export interface LCCN {
  id: string;
  project_id: string;
  lccn: string;
  status: 'pending' | 'assigned' | 'published';
  application_date: Date;
  assignment_date: Date | null;
}

export interface LCCNApplication {
  title: string;
  author: string;
  publisher: string;
  publication_date: Date;
  isbn: string;
  format: PublishingFormat;
  cip_data?: boolean; // Cataloging in Publication
}

// ============================================================================
// Book Metadata
// ============================================================================

export interface BookMetadata {
  project_id: string;
  title: string;
  subtitle?: string;
  author: string;
  co_authors?: string[];
  publisher: string;
  publication_date: Date;
  language: string;
  page_count?: number;
  word_count?: number;
  genre: string;
  subgenres: string[];
  description: string;
  short_description?: string;
  bisac_categories: string[]; // Up to 3
  keywords: string[]; // Up to 7 for Amazon
  search_terms: string[];
  age_range?: string;
  grade_range?: string;
  series?: {
    name: string;
    number: number;
  };
  price: {
    usd: number;
    ebook_usd?: number;
    print_usd?: number;
    audiobook_usd?: number;
  };
  royalty_percentage: number;
}

export interface OptimizedMetadata extends BookMetadata {
  seo_score: number;
  category_competitiveness: {
    category: string;
    difficulty: 'low' | 'medium' | 'high';
    monthly_searches: number;
  }[];
  keyword_analysis: {
    keyword: string;
    search_volume: number;
    competition: number;
    relevance: number;
  }[];
}

// ============================================================================
// Format Outputs
// ============================================================================

export interface FormatOutput {
  id: string;
  project_id: string;
  format: EbookFormat | PrintFormat;
  file_path: string;
  file_size: number;
  checksum: string;
  created_at: Date;
  validation_results: ValidationResult;
}

export interface EPUBFile {
  file: Buffer;
  size: number;
  format: 'epub2' | 'epub3';
  validation: EPUBValidation;
  toc_depth: number;
  has_cover: boolean;
}

export interface EPUBValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  version: string;
  accessibility_score?: number;
}

export interface MOBIFile {
  file: Buffer;
  size: number;
  format: 'mobi' | 'azw3';
  compression: string;
}

export interface PDFFile {
  file: Buffer;
  size: number;
  format: 'pdf';
  trim_size: TrimSize;
  page_count: number;
  bleed: boolean;
  color_profile: 'RGB' | 'CMYK';
  pdf_version: string;
}

// ============================================================================
// Cover Design
// ============================================================================

export interface CoverDesign {
  id: string;
  project_id: string;
  front_cover: Buffer;
  full_cover?: Buffer; // For print (front + spine + back)
  thumbnail: Buffer;
  spine?: Buffer;
  back_cover?: Buffer;
  dimensions: {
    width: number;
    height: number;
  };
  format: 'jpg' | 'png' | 'tiff';
  dpi: number;
  color_mode: 'RGB' | 'CMYK';
  created_at: Date;
}

export interface CoverDesignRequest {
  project_id: string;
  title: string;
  subtitle?: string;
  author: string;
  genre: string;
  style_preferences?: string;
  color_preferences?: string[];
  reference_images?: string[];
  trim_size?: TrimSize; // For print
  spine_width?: number; // Calculated from page count
}

export interface CoverGenerationResult {
  concept_description: string;
  ai_prompt: string;
  front_cover: Buffer;
  full_cover?: Buffer;
  thumbnail: Buffer;
  design_notes: string;
  cost: number;
}

// ============================================================================
// Platform Submissions
// ============================================================================

export type DistributionChannel =
  | 'amazon_kdp'
  | 'ingram_spark'
  | 'draft2digital'
  | 'findaway_voices'
  | 'kobo'
  | 'apple_books'
  | 'google_play_books'
  | 'barnes_noble';

export interface PlatformSubmission {
  id: string;
  project_id: string;
  platform: DistributionChannel;
  isbn: string;
  submission_date: Date;
  publication_date: Date | null;
  status: 'pending' | 'submitted' | 'under_review' | 'live' | 'rejected';
  platform_id?: string; // ASIN, etc.
  submission_data: Record<string, any>;
  review_notes?: string;
  live_url?: string;
}

export interface SubmissionRequest {
  isbn: string;
  title: string;
  author: string;
  description: string;
  categories: string[];
  keywords: string[];
  cover: Buffer;
  manuscript: Buffer;
  price: number;
  territories: string[]; // Geographic rights
  drm_enabled?: boolean;
  pre_order?: {
    enabled: boolean;
    release_date: Date;
  };
}

export interface SubmissionResult {
  submission_id: string;
  platform: DistributionChannel;
  status: 'ready_for_upload' | 'submitted' | 'error';
  instructions?: string;
  upload_url?: string;
  platform_response?: any;
  estimated_review_time?: number; // In days
}

// ============================================================================
// Publishing Projects
// ============================================================================

export interface PublishingProject {
  id: string;
  prose_project_id: string;
  title: string;
  author: string;
  formats: PublishingFormat[];
  distribution_channels: DistributionChannel[];
  status: PublishingStatus;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  total_cost: number;
  revenue_tracking?: RevenueTracking;
}

export type PublishingStatus =
  | 'draft'
  | 'acquiring_isbn'
  | 'registering_copyright'
  | 'converting_formats'
  | 'generating_cover'
  | 'optimizing_metadata'
  | 'validating'
  | 'submitting'
  | 'under_review'
  | 'published'
  | 'error';

export interface PublishingPipeline {
  project_id: string;
  current_phase: PublishingPhase;
  progress_percentage: number;
  phases: PublishingPhaseStatus[];
  started_at: Date;
  estimated_completion?: Date;
  actual_completion?: Date;
}

export interface PublishingPhase {
  name: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  started_at?: Date;
  completed_at?: Date;
  error?: string;
}

export interface PublishingPhaseStatus {
  phase: 'isbn_acquisition' | 'copyright_registration' | 'lccn_application' |
         'format_conversion' | 'cover_generation' | 'metadata_optimization' |
         'quality_validation' | 'platform_submission';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  message?: string;
  started_at?: Date;
  completed_at?: Date;
}

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  format: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  quality_score: number; // 0-100
  validated_at: Date;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  location?: string;
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

// ============================================================================
// Cost Tracking
// ============================================================================

export interface CostBreakdown {
  isbn_costs: number;
  copyright_costs: number;
  lccn_costs: number;
  cover_design_costs: number;
  format_conversion_costs: number;
  platform_submission_costs: number;
  total: number;
}

export interface RevenueTracking {
  total_sales: number;
  total_revenue: number;
  royalties_earned: number;
  platform_breakdown: {
    platform: DistributionChannel;
    units_sold: number;
    revenue: number;
  }[];
  last_updated: Date;
}

// ============================================================================
// Chapter Structure (from ProseCreator)
// ============================================================================

export interface Chapter {
  id: string;
  project_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  status: 'draft' | 'revised' | 'final';
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Platform Publisher Interface
// ============================================================================

export interface PlatformPublisher {
  platform: DistributionChannel;
  submitBook(request: SubmissionRequest): Promise<SubmissionResult>;
  checkSubmissionStatus(submissionId: string): Promise<PlatformSubmission>;
  updateMetadata(submissionId: string, metadata: Partial<BookMetadata>): Promise<void>;
  validateFiles(request: SubmissionRequest): Promise<ValidationResult>;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface PublishingProgressEvent {
  type: 'progress';
  project_id: string;
  phase: string;
  progress: number;
  message: string;
  timestamp: Date;
}

export interface PublishingErrorEvent {
  type: 'error';
  project_id: string;
  phase: string;
  error: string;
  timestamp: Date;
}

export interface PublishingCompleteEvent {
  type: 'complete';
  project_id: string;
  result: PublishingProject;
  timestamp: Date;
}

export type PublishingEvent =
  | PublishingProgressEvent
  | PublishingErrorEvent
  | PublishingCompleteEvent;

// ============================================================================
// Configuration
// ============================================================================

export interface PublisherConfig {
  bowker: {
    apiKey: string;
    accountId: string;
  };
  openai: {
    apiKey: string;
  };
  platforms: {
    [key in DistributionChannel]?: {
      apiKey?: string;
      accountId?: string;
      enabled: boolean;
    };
  };
  storage: {
    uploadDir: string;
    outputDir: string;
    maxFileSize: number;
  };
  costs: {
    isbn_single: number;
    isbn_10pack: number;
    isbn_100pack: number;
    copyright_registration: number;
    lccn: number;
    cover_generation: number;
  };
}
