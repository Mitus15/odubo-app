# MCP Server Setup

This repository is configured to work with Model Context Protocol (MCP) servers for enhanced AI assistant capabilities.

## Quick Setup

1. **Install MCP packages:**
   ```bash
   npm install -g @cloudflare/mcp-server-cloudflare @playwright/mcp
   ```

2. **Configure your AI assistant:**
   - **GitHub Copilot CLI**: The `.github/mcp.json` file is automatically detected
   - **Other tools**: Copy `.github/mcp.json` to your tool's MCP config location

3. **Set environment variables:**
   
   These should already be in your `.env.local`:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_API_TOKEN`
   - `CLOUDFLARE_STREAM_API_TOKEN`

## Available MCP Servers

### Cloudflare MCP
Interact with production Cloudflare services:
- **D1 Database**: Query `odubo` database, run migrations
- **R2 Storage**: List/upload/download media files
- **Stream**: Manage video uploads and transcoding

**Example prompts:**
- "Show all clips uploaded this week"
- "List files in R2 bucket under clips/"
- "Run this SQL query against production D1"

### Playwright MCP
Browser automation against production (https://odubo.studio):
- Test video playback behavior
- Verify mobile Safari compatibility
- Screenshot/record user flows
- Monitor performance

**Example prompts:**
- "Test the clips feed on mobile viewport"
- "Verify autoplay works on production"
- "Screenshot the store page"

## Security Notes

- MCP servers run locally on your machine
- Environment variables should reference production credentials
- Never commit actual API tokens to this repository
- Use tokens with minimum required permissions:
  - **Cloudflare**: D1 Read/Write, R2 Read/Write, Stream Read/Write
  - **Playwright**: No credentials needed (uses public site)

## Verification

Test your setup:
```bash
# In GitHub Copilot CLI or your AI assistant:
# "List all tables in the odubo D1 database"
# "Open https://odubo.studio and take a screenshot"
```

## Production Use Cases

### Database Operations
- Query analytics: views, engagement, user activity
- Data integrity checks: orphaned records, missing assets
- Migration verification: compare local vs production schema

### Media Management
- Audit R2 storage: file counts, sizes, organization
- Verify Stream videos: transcoding status, availability
- Cleanup operations: identify unused assets

### Testing & Monitoring
- Automated smoke tests after deployments
- Performance regression checks
- Cross-browser video playback verification

## Troubleshooting

**"Module not found" error:**
```bash
npm install -g @cloudflare/mcp-server-cloudflare @playwright/mcp
```

**Cloudflare authentication fails:**
- Verify `CLOUDFLARE_ACCOUNT_ID` matches your dashboard
- Check API token has required permissions
- Regenerate token at https://dash.cloudflare.com/profile/api-tokens

**Playwright can't access site:**
- Ensure https://odubo.studio is accessible
- Check for network/firewall restrictions
- For local testing, use `PLAYWRIGHT_BASE_URL=http://localhost:3000`
