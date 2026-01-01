# PublisherAI Technical Specification

Complete technical reference for integrating the PublisherAI book publishing plugin.

---

## API Reference

### Base URL

```
https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher
```

All endpoints require authentication via Bearer token in the Authorization header.

---

### Endpoints

#### Create Book Project

```http
POST /books
```

Creates a new book publishing project.

**Request Body:**
```json
{
  "title": "The Art of Modern Architecture",
  "subtitle": "A Comprehensive Guide",
  "author": {
    "name": "Jane Smith",
    "bio": "Award-winning architect with 20 years of experience...",
    "website": "https://janesmith.com"
  },
  "description": "A comprehensive guide to contemporary architectural design...",
  "genre": "Non-Fiction",
  "subgenres": ["Architecture", "Design", "Art"],
  "keywords": ["architecture", "modern design", "buildings"],
  "language": "en",
  "manuscriptUrl": "https://storage.example.com/manuscript.docx",
  "targetFormats": ["ebook", "print", "audiobook"],
  "printOptions": {
    "trimSize": "6x9",
    "paperType": "cream",
    "binding": "paperback"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bookId": "book_abc123",
    "title": "The Art of Modern Architecture",
    "status": "created",
    "manuscriptAnalysis": {
      "wordCount": 75000,
      "estimatedPages": 320,
      "chapters": 15,
      "language": "en",
      "readingLevel": "advanced"
    },
    "nextSteps": [
      "isbn_acquisition",
      "format_conversion",
      "cover_design"
    ],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### Convert to Formats

```http
POST /books/:id/convert
```

Converts manuscript to publishable formats.

**Request Body:**
```json
{
  "formats": ["ebook", "print"],
  "ebookOptions": {
    "formats": ["epub", "mobi", "pdf"],
    "includeTableOfContents": true,
    "includeCoverInEbook": true
  },
  "printOptions": {
    "trimSize": "6x9",
    "paperType": "cream | white",
    "binding": "paperback | hardcover",
    "bleed": false
  },
  "coverUrl": "https://storage.example.com/cover.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversionId": "conv_xyz789",
    "bookId": "book_abc123",
    "status": "processing",
    "formats": [
      {
        "type": "epub",
        "status": "processing",
        "estimatedCompletion": "2024-01-15T11:00:00Z"
      },
      {
        "type": "mobi",
        "status": "queued"
      },
      {
        "type": "print_pdf",
        "status": "queued",
        "specs": {
          "trimSize": "6x9",
          "pages": 320,
          "spineWidth": "0.72in"
        }
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### Distribute to Platforms

```http
POST /books/:id/distribute
```

Distributes book to retail platforms.

**Request Body:**
```json
{
  "channels": ["amazon_kdp", "ingram_spark", "kobo", "apple_books"],
  "pricing": {
    "ebook": {
      "usd": 9.99,
      "gbp": 7.99,
      "eur": 8.99
    },
    "print": {
      "usd": 14.99,
      "gbp": 12.99,
      "eur": 13.99
    }
  },
  "territories": ["worldwide"],
  "releaseDate": "2024-02-01",
  "preorderEnabled": true,
  "categories": {
    "bisac": ["ARC001000", "ARC005000"],
    "amazon": ["Architecture", "Design"]
  },
  "keywords": ["architecture", "modern design", "buildings", "art"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distributionId": "dist_abc123",
    "bookId": "book_abc123",
    "status": "processing",
    "channels": [
      {
        "platform": "amazon_kdp",
        "status": "submitted",
        "expectedLiveDate": "2024-01-18",
        "formats": ["ebook", "print"]
      },
      {
        "platform": "ingram_spark",
        "status": "pending_review",
        "expectedLiveDate": "2024-02-01",
        "formats": ["print"]
      },
      {
        "platform": "kobo",
        "status": "submitted",
        "expectedLiveDate": "2024-01-17",
        "formats": ["ebook"]
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### Get Royalty Report

```http
GET /royalties
```

Returns royalty earnings across all platforms.

**Query Parameters:**
- `bookId`: Filter by book (optional)
- `period`: `month | quarter | year`
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "summary": {
      "totalEarnings": 4523.45,
      "totalSales": 856,
      "averagePrice": 11.23,
      "currency": "USD"
    },
    "byBook": [
      {
        "bookId": "book_abc123",
        "title": "The Art of Modern Architecture",
        "earnings": 2450.00,
        "sales": 412,
        "ebookSales": 350,
        "printSales": 62
      }
    ],
    "byPlatform": [
      {
        "platform": "amazon_kdp",
        "earnings": 2850.00,
        "sales": 520,
        "royaltyRate": 0.70
      },
      {
        "platform": "ingram_spark",
        "earnings": 1200.00,
        "sales": 180,
        "royaltyRate": 0.55
      }
    ],
    "byFormat": {
      "ebook": {
        "earnings": 3200.00,
        "sales": 680
      },
      "print": {
        "earnings": 1323.45,
        "sales": 176
      }
    },
    "byTerritory": [
      {
        "territory": "US",
        "earnings": 3100.00,
        "sales": 580
      },
      {
        "territory": "UK",
        "earnings": 850.00,
        "sales": 156
      }
    ]
  }
}
```

---

#### Acquire ISBN

```http
POST /isbn/acquire
```

Acquires ISBN through Bowker integration.

**Request Body:**
```json
{
  "bookId": "book_abc123",
  "format": "ebook | print | audiobook",
  "quantity": 1,
  "imprintName": "Author Name Publishing"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isbnId": "isbn_xyz789",
    "isbn13": "978-1-234567-89-0",
    "isbn10": "1-234567-89-X",
    "format": "print",
    "barcode": {
      "url": "https://cdn.adverant.ai/barcodes/isbn_xyz789.png",
      "format": "EAN-13"
    },
    "registeredAt": "2024-01-15T10:30:00Z",
    "status": "active"
  }
}
```

---

#### Get Book Status

```http
GET /books/:id/status
```

Returns current publishing status and pipeline progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "bookId": "book_abc123",
    "title": "The Art of Modern Architecture",
    "overallStatus": "publishing",
    "progress": 75,
    "pipeline": [
      {
        "phase": "isbn_acquisition",
        "status": "completed",
        "completedAt": "2024-01-15T11:00:00Z"
      },
      {
        "phase": "copyright_registration",
        "status": "completed",
        "completedAt": "2024-01-15T12:00:00Z"
      },
      {
        "phase": "format_conversion",
        "status": "completed",
        "completedAt": "2024-01-15T14:00:00Z"
      },
      {
        "phase": "cover_generation",
        "status": "completed",
        "completedAt": "2024-01-15T15:00:00Z"
      },
      {
        "phase": "metadata_optimization",
        "status": "completed",
        "completedAt": "2024-01-15T15:30:00Z"
      },
      {
        "phase": "quality_validation",
        "status": "in_progress",
        "progress": 80
      },
      {
        "phase": "platform_submission",
        "status": "pending"
      }
    ],
    "distribution": {
      "amazon_kdp": {
        "status": "pending",
        "asin": null
      },
      "ingram_spark": {
        "status": "pending"
      }
    },
    "files": {
      "epub": "https://cdn.adverant.ai/...",
      "mobi": "https://cdn.adverant.ai/...",
      "print_pdf": "https://cdn.adverant.ai/...",
      "cover": "https://cdn.adverant.ai/..."
    }
  }
}
```

---

#### Get Sales Analytics

```http
GET /sales
```

Returns detailed sales analytics.

**Query Parameters:**
- `bookId`: Filter by book
- `period`: `day | week | month | year`
- `groupBy`: `date | platform | territory | format`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "summary": {
      "totalSales": 856,
      "totalRevenue": 8234.56,
      "averageOrderValue": 9.62,
      "returnRate": 0.02
    },
    "trends": {
      "salesByDay": [
        { "date": "2024-01-01", "sales": 28, "revenue": 268.44 },
        { "date": "2024-01-02", "sales": 32, "revenue": 307.68 }
      ]
    },
    "topBooks": [
      {
        "bookId": "book_abc123",
        "title": "The Art of Modern Architecture",
        "sales": 412,
        "revenue": 4523.45,
        "rank": 1
      }
    ],
    "geographicBreakdown": [
      { "country": "US", "sales": 520, "percentage": 0.61 },
      { "country": "UK", "sales": 156, "percentage": 0.18 }
    ]
  }
}
```

---

## Authentication

### Bearer Token

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher/books" \
  -H "Authorization: Bearer YOUR_NEXUS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Book", "author": {"name": "John Doe"}}'
```

### Token Scopes

| Scope | Description |
|-------|-------------|
| `publisher:read` | View books and status |
| `publisher:write` | Create and update books |
| `publisher:convert` | Convert formats |
| `publisher:distribute` | Distribute to platforms |
| `publisher:isbn` | Acquire ISBNs |
| `publisher:royalties` | View royalty reports |

---

## Rate Limits

| Tier | Requests/Minute | Books/Year |
|------|-----------------|------------|
| Indie | 30 | 5 |
| Author | 60 | 20 |
| Publisher | 120 | Unlimited |

---

## Data Models

### Book

```typescript
interface Book {
  bookId: string;
  title: string;
  subtitle?: string;
  author: Author;
  description: string;
  genre: string;
  subgenres: string[];
  keywords: string[];
  language: string;
  status: BookStatus;
  isbn?: ISBN;
  formats: BookFormat[];
  distribution: Distribution[];
  pricing: Pricing;
  metadata: BookMetadata;
  createdAt: string;
  publishedAt?: string;
}

type BookStatus = 'draft' | 'processing' | 'ready' |
                  'publishing' | 'published' | 'unpublished';

interface Author {
  name: string;
  bio?: string;
  website?: string;
  email?: string;
}
```

### ISBN

```typescript
interface ISBN {
  id: string;
  isbn13: string;
  isbn10: string;
  format: 'ebook' | 'print' | 'audiobook';
  barcodeUrl: string;
  registeredAt: string;
  status: 'active' | 'inactive';
}
```

### Book Format

```typescript
interface BookFormat {
  type: FormatType;
  status: ConversionStatus;
  fileUrl?: string;
  fileSize?: number;
  specs?: FormatSpecs;
  validatedAt?: string;
}

type FormatType = 'epub' | 'mobi' | 'pdf' | 'print_pdf' | 'audiobook';
type ConversionStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface FormatSpecs {
  trimSize?: string;
  pages?: number;
  spineWidth?: string;
  paperType?: string;
  binding?: string;
}
```

### Distribution

```typescript
interface Distribution {
  platform: Platform;
  status: DistributionStatus;
  submittedAt?: string;
  liveAt?: string;
  productId?: string;
  productUrl?: string;
  formats: FormatType[];
}

type Platform = 'amazon_kdp' | 'ingram_spark' | 'kobo' |
                'apple_books' | 'google_play' | 'barnes_noble' |
                'draft2digital' | 'findaway_voices';

type DistributionStatus = 'pending' | 'submitted' | 'in_review' |
                          'live' | 'rejected' | 'unpublished';
```

### Royalty

```typescript
interface Royalty {
  bookId: string;
  platform: Platform;
  period: {
    start: string;
    end: string;
  };
  sales: number;
  earnings: number;
  currency: string;
  royaltyRate: number;
  format: FormatType;
  territory: string;
}
```

---

## SDK Integration

### JavaScript/TypeScript SDK

```typescript
import { NexusClient } from '@nexus/sdk';

const nexus = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY,
});

// Create book project
const book = await nexus.publisher.createBook({
  title: 'The Art of Modern Architecture',
  author: { name: 'Jane Smith' },
  description: 'A comprehensive guide...',
  genre: 'Non-Fiction',
  manuscriptUrl: 'https://storage.example.com/manuscript.docx',
});

// Acquire ISBN
const isbn = await nexus.publisher.acquireISBN({
  bookId: book.bookId,
  format: 'print',
});

console.log(`ISBN: ${isbn.isbn13}`);

// Convert formats
const conversion = await nexus.publisher.convert(book.bookId, {
  formats: ['ebook', 'print'],
  printOptions: { trimSize: '6x9' },
});

// Wait for conversion
await nexus.publisher.waitForConversion(conversion.conversionId);

// Distribute
const distribution = await nexus.publisher.distribute(book.bookId, {
  channels: ['amazon_kdp', 'ingram_spark'],
  pricing: {
    ebook: { usd: 9.99 },
    print: { usd: 14.99 },
  },
});

// Get royalties
const royalties = await nexus.publisher.getRoyalties({
  bookId: book.bookId,
  period: 'month',
});

console.log(`Total earnings: $${royalties.summary.totalEarnings}`);
```

### Python SDK

```python
from nexus import NexusClient

client = NexusClient(api_key=os.environ["NEXUS_API_KEY"])

# Create book
book = client.publisher.create_book(
    title="The Art of Modern Architecture",
    author={"name": "Jane Smith"},
    description="A comprehensive guide...",
    genre="Non-Fiction",
    manuscript_url="https://storage.example.com/manuscript.docx"
)

# Acquire ISBN
isbn = client.publisher.acquire_isbn(
    book_id=book.book_id,
    format="print"
)

print(f"ISBN: {isbn.isbn13}")

# Convert and distribute
conversion = client.publisher.convert(
    book.book_id,
    formats=["ebook", "print"]
)

client.publisher.wait_for_conversion(conversion.conversion_id)

distribution = client.publisher.distribute(
    book.book_id,
    channels=["amazon_kdp", "ingram_spark"],
    pricing={"ebook": {"usd": 9.99}, "print": {"usd": 14.99}}
)

# Get royalties
royalties = client.publisher.get_royalties(
    book_id=book.book_id,
    period="month"
)

print(f"Total earnings: ${royalties.summary.total_earnings}")
```

---

## Distribution Platforms

| Platform | Ebook | Print | Audiobook | Setup Time |
|----------|-------|-------|-----------|------------|
| Amazon KDP | Yes | Yes | No | 24-72 hours |
| IngramSpark | Yes | Yes | No | 2-4 weeks |
| Kobo | Yes | No | No | 24-72 hours |
| Apple Books | Yes | No | No | 24-72 hours |
| Google Play | Yes | No | No | 24-48 hours |
| Barnes & Noble | Yes | Yes | No | 24-72 hours |
| Draft2Digital | Yes | No | No | 24-48 hours |
| Findaway Voices | No | No | Yes | 2-4 weeks |

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request |
| `INVALID_MANUSCRIPT` | 400 | Manuscript cannot be processed |
| `BOOK_NOT_FOUND` | 404 | Book does not exist |
| `ISBN_UNAVAILABLE` | 400 | ISBN cannot be acquired |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid token |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 402 | Yearly book limit reached |
| `PLATFORM_ERROR` | 502 | Distribution platform error |

---

## Deployment Requirements

### Container Specifications

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 500m | 1000m |
| Memory | 1Gi | 2Gi |
| Storage | 25Gi | 50Gi |
| Timeout | 10 min | 15 min |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXUS_API_KEY` | Yes | Nexus platform API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MAGEAGENT_URL` | Yes | MageAgent AI service URL |
| `FILEPROCESS_URL` | Yes | File processing service URL |
| `BOWKER_API_KEY` | No | Bowker ISBN API |
| `KDP_API_KEY` | No | Amazon KDP integration |
| `INGRAM_API_KEY` | No | IngramSpark integration |

### Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 8080
  initialDelaySeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
```

---

## Supported Manuscript Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Word | .docx, .doc | Recommended |
| OpenDocument | .odt | Supported |
| Rich Text | .rtf | Supported |
| ePub | .epub | For republishing |
| PDF | .pdf | Print-ready only |
| Markdown | .md | With frontmatter |

---

## Quotas and Limits

| Limit | Indie | Author | Publisher |
|-------|-------|--------|-----------|
| Books/Year | 5 | 20 | Unlimited |
| Platforms | 3 | 10 | Unlimited |
| ISBN Included | 1 | 5 | 20 |
| Storage | 5 GB | 25 GB | 100 GB |
| Conversion Priority | Standard | Priority | Dedicated |

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/publisher](https://docs.adverant.ai/plugins/publisher)
- **API Status**: [status.adverant.ai](https://status.adverant.ai)
- **Support Email**: support@adverant.ai
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
