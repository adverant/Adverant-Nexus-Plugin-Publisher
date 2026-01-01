# PublisherAI - Book Publishing and Distribution Platform

[![Nexus Plugin](https://img.shields.io/badge/Nexus-Plugin-blue)](https://adverant.ai/marketplace)
[![Version](https://img.shields.io/badge/version-1.0.0-green)](https://github.com/adverant/Adverant-Nexus-Plugin-Publisher/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**PublisherAI** is a comprehensive AI-powered book publishing platform that handles the entire publishing lifecycle from ISBN acquisition to global distribution. Transform your manuscript into a professionally published book distributed across Amazon KDP, IngramSpark, Kobo, and more.

---

## Overview

PublisherAI automates the complex, traditionally manual publishing process into a streamlined eight-phase pipeline. Authors and publishers can go from final manuscript to published book in days rather than months, with professional-quality results at a fraction of traditional publishing costs.

### Key Capabilities

- **ISBN Management**: Automated ISBN acquisition through Bowker integration with barcode generation
- **Copyright Registration**: Streamlined US Copyright Office registration with Form TX automation
- **LCCN Application**: Library of Congress Control Number application for print editions
- **Multi-Format Conversion**: Professional EPUB, MOBI, and print-ready PDF generation
- **AI Cover Design**: Genre-aware cover generation with spine calculation for print editions
- **Metadata Optimization**: SEO-optimized descriptions, categories, and keywords for discoverability
- **Quality Validation**: Platform-specific validation ensuring first-submission acceptance
- **Global Distribution**: One-click publishing to Amazon KDP, IngramSpark, Draft2Digital, and Findaway Voices

---

## Quick Start

### Installation

```bash
# Via Nexus CLI
nexus auth login
nexus plugin install nexus-publisher

# Via API
curl -X POST "https://api.adverant.ai/plugins/nexus-publisher/install" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Publish Your First Book

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const client = new NexusClient({ apiKey: process.env.NEXUS_API_KEY });
const publisher = client.plugin('nexus-publisher');

// Create a publishing project
const project = await publisher.books.create({
  title: "The Art of Modern Architecture",
  author: "Jane Smith",
  description: "A comprehensive guide to contemporary architectural design...",
  genre: "Non-Fiction",
  subgenres: ["Architecture", "Design"],
  manuscriptFile: fs.createReadStream('./manuscript.docx')
});

// Convert to multiple formats
await publisher.books.convert(project.id, {
  formats: ['ebook', 'print'],
  trimSize: '6x9'
});

// Distribute globally
const distribution = await publisher.books.distribute(project.id, {
  channels: ['amazon_kdp', 'ingram_spark'],
  pricing: { usd: 14.99 },
  territories: ['worldwide']
});

console.log(`Published! Amazon ASIN: ${distribution.amazon_kdp.asin}`);
```

---

## Pricing

| Tier | Monthly | Books/Year | Platforms | Features |
|------|---------|------------|-----------|----------|
| **Indie Author** | $19 | 5 | 3 | Basic conversion, Amazon KDP, Metadata |
| **Professional Author** | $49 | 20 | 10 | All formats, IngramSpark, ISBN management, Royalty tracking |
| **Publisher** | $199 | Unlimited | Unlimited | White-label, Bulk distribution, API access |

---

## Supported Distribution Platforms

| Platform | Format | Reach | Setup Time |
|----------|--------|-------|------------|
| **Amazon KDP** | Ebook, Print | 14 countries | 24-72 hours |
| **IngramSpark** | Print, Ebook | 40,000+ retailers | 2-4 weeks |
| **Draft2Digital** | Ebook | Multiple retailers | 24-48 hours |
| **Findaway Voices** | Audiobook | Audible, iTunes | 2-4 weeks |
| **Kobo** | Ebook | Kobo stores worldwide | 24-72 hours |
| **Apple Books** | Ebook | 51 countries | 24-72 hours |
| **Google Play Books** | Ebook | 75+ countries | 24-48 hours |
| **Barnes and Noble** | Ebook, Print | US market | 24-72 hours |

---

## Publishing Pipeline

PublisherAI executes an eight-phase publishing pipeline with real-time progress tracking:

```
Phase 1: ISBN Acquisition (10%)
    ↓
Phase 2: Copyright Registration (20%)
    ↓
Phase 3: LCCN Application (30%)
    ↓
Phase 4: Format Conversion (50%)
    ↓
Phase 5: Cover Generation (65%)
    ↓
Phase 6: Metadata Optimization (75%)
    ↓
Phase 7: Quality Validation (85%)
    ↓
Phase 8: Platform Submission (100%)
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/publisher/books` | Create book project |
| `POST` | `/api/v1/publisher/books/:id/convert` | Convert to formats |
| `POST` | `/api/v1/publisher/books/:id/distribute` | Distribute to platforms |
| `GET` | `/api/v1/publisher/royalties` | Get royalty report |
| `GET` | `/api/v1/publisher/books/:id/status` | Get publishing status |
| `POST` | `/api/v1/publisher/isbn/acquire` | Acquire ISBN |
| `GET` | `/api/v1/publisher/sales` | Get sales analytics |

---

## Documentation

- **[Quick Start Guide](QUICKSTART.md)**: Get started in 15 minutes
- **[Use Cases](USE-CASES.md)**: Real-world publishing scenarios
- **[Architecture](ARCHITECTURE.md)**: Technical deep dive
- **[API Reference](docs/api-reference/endpoints.md)**: Complete endpoint documentation
- **[Configuration Guide](docs/getting-started/configuration.md)**: Setup and configuration

---

## Requirements

- **Nexus Account**: Active subscription at [adverant.ai](https://adverant.ai)
- **Nexus Version**: 1.0.0 or higher
- **Permissions**: `network:external`, `filesystem:temp`, `service:mageagent`, `service:fileprocess`

---

## Resource Allocation

```yaml
cpuMillicores: 1000
memoryMB: 2048
diskGB: 50
timeoutMs: 600000
maxConcurrentJobs: 10
```

---

## Security

- All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- ISBN and copyright credentials stored in secure vault
- Platform API keys never exposed in logs or responses
- SOC 2 Type II compliant

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/publisher](https://docs.adverant.ai/plugins/publisher)
- **Discord Community**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email Support**: support@adverant.ai
- **GitHub Issues**: [Report bugs](https://github.com/adverant/Adverant-Nexus-Plugin-Publisher/issues)

---

## License

Apache-2.0. See [LICENSE](LICENSE) for details.

---

**Adverant** | [adverant.ai](https://adverant.ai) | plugins@adverant.ai
