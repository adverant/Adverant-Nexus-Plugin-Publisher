/**
 * Configuration management for Publisher Service
 */

import dotenv from 'dotenv';
import { PublisherConfig } from '../types';

dotenv.config();

export const config: PublisherConfig = {
  bowker: {
    apiKey: process.env.BOWKER_API_KEY || '',
    accountId: process.env.BOWKER_ACCOUNT_ID || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  platforms: {
    amazon_kdp: {
      apiKey: process.env.AMAZON_KDP_API_KEY,
      enabled: true,
    },
    ingram_spark: {
      apiKey: process.env.INGRAM_SPARK_API_KEY,
      enabled: true,
    },
    draft2digital: {
      apiKey: process.env.DRAFT2DIGITAL_API_KEY,
      enabled: true,
    },
    findaway_voices: {
      apiKey: process.env.FINDAWAY_VOICES_API_KEY,
      enabled: true,
    },
  },
  storage: {
    uploadDir: process.env.UPLOAD_DIR || '/app/uploads',
    outputDir: process.env.OUTPUT_DIR || '/app/outputs',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10),
  },
  costs: {
    isbn_single: parseFloat(process.env.ISBN_COST_SINGLE || '125'),
    isbn_10pack: parseFloat(process.env.ISBN_COST_10PACK || '295'),
    isbn_100pack: parseFloat(process.env.ISBN_COST_100PACK || '1500'),
    copyright_registration: parseFloat(process.env.COPYRIGHT_REG_COST || '65'),
    lccn: parseFloat(process.env.LCCN_COST || '0'),
    cover_generation: parseFloat(process.env.COVER_GENERATION_COST || '0.40'),
  },
};

export const serverConfig = {
  port: parseInt(process.env.PORT || '9012', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nexus',
  graphragApiUrl: process.env.GRAPHRAG_API_URL || 'http://localhost:9000',
  mageagentApiUrl: process.env.MAGEAGENT_API_URL || 'http://localhost:9001',
  learningAgentApiUrl: process.env.LEARNING_AGENT_API_URL || 'http://localhost:9003',
};

export default config;
