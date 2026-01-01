# Quick Start Guide - PublisherAI

Get your book published and distributed globally in under 15 minutes with PublisherAI.

---

## Prerequisites

Before starting, ensure you have:

- **Nexus Account**: Active subscription at [adverant.ai](https://adverant.ai)
- **API Key**: Generate from Dashboard > Settings > API Keys
- **Manuscript File**: Final manuscript in DOCX, RTF, or plain text format
- **Nexus CLI** (optional): For command-line installation

```bash
# Install Nexus CLI
npm install -g @adverant/nexus-cli
```

---

## Installation

### Via Nexus CLI (Recommended)

```bash
# Authenticate with your API key
nexus auth login

# Install the PublisherAI plugin
nexus plugin install nexus-publisher

# Verify installation
nexus plugin list
```

### Via API

```bash
curl -X POST "https://api.adverant.ai/plugins/nexus-publisher/install" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "status": "installed",
  "pluginId": "nexus-publisher",
  "version": "1.0.0",
  "activatedAt": "2024-01-15T10:00:00Z"
}
```

### Via Dashboard

1. Navigate to **Nexus Marketplace**
2. Search for "PublisherAI" or browse the **Publishing** category
3. Click **Install Plugin**
4. Confirm installation and accept permissions

---

## Verify Installation

```bash
# Check plugin health
curl "https://api.adverant.ai/proxy/nexus-publisher/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "capabilities": [
    "isbn-management",
    "format-conversion",
    "multi-platform-distribution",
    "metadata-optimization",
    "royalty-tracking",
    "sales-analytics"
  ]
}
```

---

## First Publishing Operation

### Via Dashboard

1. Navigate to **Plugins > PublisherAI**
2. Click **New Book Project**
3. Fill in book details:
   - Title and subtitle
   - Author name
   - Description (2000+ characters recommended)
   - Genre and subgenres
4. Upload your manuscript file
5. Select **Output Formats**:
   - Ebook (EPUB/MOBI)
   - Print (Paperback/Hardcover)
6. Choose **Distribution Channels**:
   - Amazon KDP
   - IngramSpark
   - Others as needed
7. Click **Start Publishing**
8. Monitor progress through the eight-phase pipeline

### Via API

#### Step 1: Create Book Project

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher/books" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "title=The Art of Modern Architecture" \
  -F "author=Jane Smith" \
  -F "description=A comprehensive exploration of contemporary architectural design principles..." \
  -F "genre=Non-Fiction" \
  -F "subgenres=[\"Architecture\",\"Design\",\"Art\"]" \
  -F "manuscript=@manuscript.docx"
```

**Response:**
```json
{
  "projectId": "pub_8k4m2n7p",
  "title": "The Art of Modern Architecture",
  "author": "Jane Smith",
  "status": "draft",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Step 2: Convert to Publishing Formats

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher/books/pub_8k4m2n7p/convert" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "formats": ["ebook", "print"],
    "ebookOptions": {
      "epub3": true,
      "mobi": true
    },
    "printOptions": {
      "trimSize": "6x9",
      "paperType": "cream",
      "binding": "paperback"
    }
  }'
```

**Response:**
```json
{
  "projectId": "pub_8k4m2n7p",
  "status": "converting",
  "formats": {
    "epub": { "status": "processing", "estimatedTime": 120 },
    "mobi": { "status": "queued" },
    "pdf": { "status": "queued", "trimSize": "6x9" }
  }
}
```

#### Step 3: Distribute to Platforms

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher/books/pub_8k4m2n7p/distribute" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": ["amazon_kdp", "ingram_spark"],
    "pricing": {
      "ebook_usd": 9.99,
      "print_usd": 14.99
    },
    "territories": ["US", "CA", "UK", "AU", "DE", "FR"],
    "releaseDate": "2024-02-01",
    "preOrder": false
  }'
```

**Response:**
```json
{
  "projectId": "pub_8k4m2n7p",
  "distributions": [
    {
      "platform": "amazon_kdp",
      "status": "submitted",
      "estimatedLiveDate": "2024-01-18T00:00:00Z",
      "submissionId": "amz_sub_9f2k4m"
    },
    {
      "platform": "ingram_spark",
      "status": "submitted",
      "estimatedLiveDate": "2024-02-05T00:00:00Z",
      "submissionId": "ing_sub_3n7p2q"
    }
  ]
}
```

#### Step 4: Check Publishing Status

```bash
curl "https://api.adverant.ai/proxy/nexus-publisher/api/v1/publisher/books/pub_8k4m2n7p/status" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "projectId": "pub_8k4m2n7p",
  "title": "The Art of Modern Architecture",
  "status": "published",
  "pipeline": {
    "currentPhase": "complete",
    "progressPercentage": 100,
    "phases": [
      { "phase": "isbn_acquisition", "status": "completed", "isbn": "978-1-234567-89-0" },
      { "phase": "copyright_registration", "status": "completed", "registrationId": "TXu-002-345-678" },
      { "phase": "lccn_application", "status": "completed", "lccn": "2024012345" },
      { "phase": "format_conversion", "status": "completed" },
      { "phase": "cover_generation", "status": "completed" },
      { "phase": "metadata_optimization", "status": "completed", "seoScore": 92 },
      { "phase": "quality_validation", "status": "completed", "qualityScore": 98 },
      { "phase": "platform_submission", "status": "completed" }
    ]
  },
  "liveUrls": {
    "amazon_kdp": "https://www.amazon.com/dp/B0CXXXXXXX",
    "ingram_spark": "https://www.ingramcontent.com/title/978-1-234567-89-0"
  }
}
```

---

## SDK Examples

### TypeScript/JavaScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';
import * as fs from 'fs';

// Initialize client
const client = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

// Access PublisherAI plugin
const publisher = client.plugin('nexus-publisher');

// Complete publishing workflow
async function publishBook(manuscriptPath: string, bookInfo: BookInfo) {
  // Step 1: Create project
  const project = await publisher.books.create({
    title: bookInfo.title,
    author: bookInfo.author,
    description: bookInfo.description,
    genre: bookInfo.genre,
    subgenres: bookInfo.subgenres,
    manuscript: fs.createReadStream(manuscriptPath)
  });

  console.log(`Project created: ${project.projectId}`);

  // Step 2: Acquire ISBN
  const isbn = await publisher.isbn.acquire({
    projectId: project.projectId,
    formats: ['ebook', 'print']
  });

  console.log(`ISBN assigned: ${isbn.isbn_13}`);

  // Step 3: Generate cover
  const cover = await publisher.covers.generate({
    projectId: project.projectId,
    title: bookInfo.title,
    author: bookInfo.author,
    genre: bookInfo.genre,
    trimSize: '6x9'
  });

  console.log(`Cover generated: ${cover.conceptDescription}`);

  // Step 4: Convert formats
  const formats = await publisher.books.convert(project.projectId, {
    formats: ['ebook', 'print'],
    printOptions: { trimSize: '6x9', binding: 'paperback' }
  });

  // Wait for conversion
  await formats.waitForCompletion();

  // Step 5: Optimize metadata
  const metadata = await publisher.metadata.optimize({
    projectId: project.projectId,
    targetPlatforms: ['amazon_kdp', 'ingram_spark']
  });

  console.log(`SEO Score: ${metadata.seoScore}`);

  // Step 6: Distribute
  const distribution = await publisher.books.distribute(project.projectId, {
    channels: ['amazon_kdp', 'ingram_spark', 'draft2digital'],
    pricing: {
      ebook_usd: 9.99,
      print_usd: 14.99
    },
    territories: ['worldwide']
  });

  console.log('Distribution submitted!');
  distribution.distributions.forEach(d => {
    console.log(`  ${d.platform}: ${d.status} (est. ${d.estimatedLiveDate})`);
  });

  return project;
}

// Run
publishBook('./manuscript.docx', {
  title: 'The Art of Modern Architecture',
  author: 'Jane Smith',
  description: 'A comprehensive exploration of contemporary architectural design...',
  genre: 'Non-Fiction',
  subgenres: ['Architecture', 'Design']
});
```

### Python

```python
import os
from nexus_sdk import NexusClient

# Initialize client
client = NexusClient(api_key=os.environ['NEXUS_API_KEY'])

# Access PublisherAI plugin
publisher = client.plugin('nexus-publisher')

def publish_book(manuscript_path: str, book_info: dict) -> dict:
    """Complete publishing workflow from manuscript to global distribution."""

    # Step 1: Create project
    with open(manuscript_path, 'rb') as f:
        project = publisher.books.create(
            title=book_info['title'],
            author=book_info['author'],
            description=book_info['description'],
            genre=book_info['genre'],
            subgenres=book_info['subgenres'],
            manuscript=f
        )

    print(f"Project created: {project.project_id}")

    # Step 2: Run full publishing pipeline
    pipeline = publisher.books.publish_full(
        project_id=project.project_id,
        formats=['ebook', 'print'],
        distribution_channels=['amazon_kdp', 'ingram_spark'],
        pricing={
            'ebook_usd': 9.99,
            'print_usd': 14.99
        }
    )

    # Monitor progress
    for event in pipeline.stream_progress():
        print(f"[{event.progress}%] {event.phase}: {event.message}")

    # Get final results
    result = pipeline.get_result()

    print(f"\nPublishing complete!")
    print(f"  ISBN: {result.isbn}")
    print(f"  Copyright: {result.copyright_registration_id}")
    print(f"  Amazon URL: {result.live_urls.get('amazon_kdp')}")

    return result

def get_royalty_report(start_date: str, end_date: str) -> dict:
    """Get royalty report for date range."""

    report = publisher.royalties.get(
        start_date=start_date,
        end_date=end_date,
        group_by='platform'
    )

    print(f"Royalty Report: {start_date} to {end_date}")
    print(f"  Total Revenue: ${report.total_revenue:.2f}")
    print(f"  Total Royalties: ${report.total_royalties:.2f}")

    for platform in report.platform_breakdown:
        print(f"  {platform.name}: {platform.units_sold} units, ${platform.royalties:.2f}")

    return report

# Example usage
if __name__ == '__main__':
    book = publish_book('./manuscript.docx', {
        'title': 'The Art of Modern Architecture',
        'author': 'Jane Smith',
        'description': 'A comprehensive exploration of contemporary architectural design...',
        'genre': 'Non-Fiction',
        'subgenres': ['Architecture', 'Design']
    })

    # Check royalties after publication
    royalties = get_royalty_report('2024-01-01', '2024-03-31')
```

---

## Rate Limits

Rate limits are enforced based on your subscription tier:

| Tier | Books/Year | Platforms | API Requests/Minute | Concurrent Jobs |
|------|------------|-----------|---------------------|-----------------|
| **Indie Author** | 5 | 3 | 30 | 2 |
| **Professional Author** | 20 | 10 | 100 | 5 |
| **Publisher** | Unlimited | Unlimited | Custom | 10 |

### Handling Rate Limits

When rate limited, you will receive a `429` response:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retryAfter": 60,
      "currentUsage": 30,
      "limit": 30
    }
  }
}
```

---

## Publishing Timeline

Expected timelines for each distribution platform:

| Platform | Review Time | Go-Live |
|----------|------------|---------|
| Amazon KDP | 24-72 hours | Within 72 hours |
| IngramSpark | 5-10 business days | 2-4 weeks |
| Draft2Digital | 24-48 hours | Within 48 hours |
| Findaway Voices | 10-14 business days | 2-4 weeks |
| Kobo | 24-72 hours | Within 72 hours |
| Apple Books | 24-72 hours | Within 72 hours |

---

## Next Steps

Now that you have published your first book, explore these resources:

- **[Use Cases](USE-CASES.md)**: Real-world publishing scenarios and workflows
- **[Architecture](ARCHITECTURE.md)**: Technical deep dive and integration patterns
- **[API Reference](docs/api-reference/endpoints.md)**: Complete endpoint documentation
- **[Royalty Tracking](docs/guides/royalty-tracking.md)**: Monitor sales and earnings

---

## Common Issues

### Manuscript Processing Fails

- **Check file format**: Supported formats include DOCX, RTF, TXT, HTML
- **File size limit**: Maximum 100MB per manuscript
- **Encoding issues**: Ensure UTF-8 encoding for special characters

### Format Conversion Errors

- **Image resolution**: Embedded images require minimum 300 DPI for print
- **Font embedding**: Use standard or licensed fonts only
- **Table complexity**: Simplify complex tables for ebook formats

### Platform Rejection

- **Cover dimensions**: Each platform has specific requirements (see validation)
- **Metadata length**: Descriptions have character limits per platform
- **Category mismatch**: Ensure BISAC categories are platform-compatible

### ISBN Assignment Delays

- **Bowker verification**: First-time publishers require verification (24-48 hours)
- **Inventory**: ISBN pool may need replenishment for high-volume publishers

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/publisher](https://docs.adverant.ai/plugins/publisher)
- **Discord Community**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email Support**: support@adverant.ai
- **GitHub Issues**: [Report bugs](https://github.com/adverant/Adverant-Nexus-Plugin-Publisher/issues)
