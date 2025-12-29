# Installation

This guide covers how to install {{PLUGIN_DISPLAY_NAME}} in your Nexus environment.

## Prerequisites

- Nexus Platform 1.0.0 or higher
- Active Nexus account
- Appropriate subscription tier (see [Pricing](/docs/pricing.md))

## Installation Methods

### Via Nexus Marketplace (Recommended)

1. Navigate to **Plugins > Marketplace** in your Nexus Dashboard
2. Search for "{{PLUGIN_DISPLAY_NAME}}"
3. Click **Install**
4. Select your subscription tier
5. Confirm installation

### Via CLI

```bash
nexus plugin install {{PLUGIN_NAME}}
```

### Via API

```bash
curl -X POST "https://api.adverant.ai/plugins/{{PLUGIN_NAME}}/install" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Post-Installation

After installation, the plugin will be available at:
- **Dashboard**: Plugins > {{PLUGIN_DISPLAY_NAME}}
- **API**: `https://api.adverant.ai/proxy/{{PLUGIN_NAME}}/api/v1/*`

## Verification

Verify the installation:

```bash
# Check plugin status
nexus plugin status {{PLUGIN_NAME}}

# Or via API
curl "https://api.adverant.ai/proxy/{{PLUGIN_NAME}}/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "..."
}
```

## Troubleshooting

### Installation Fails

1. Verify your Nexus version meets minimum requirements
2. Check your subscription tier supports this plugin
3. Ensure API key has `plugins:install` permission

### Plugin Not Appearing

1. Clear browser cache
2. Refresh the dashboard
3. Check installation status via CLI

## Next Steps

- [Configuration](/docs/getting-started/configuration.md)
- [Quick Start](/docs/getting-started/quickstart.md)
- [API Reference](/docs/api-reference/endpoints.md)
