# VibeFlare MCP Server 🚀

**Agent-controlled CMS powered by Cloudflare Workers and the Model Context Protocol (MCP)**

VibeFlare is a Cloudflare-native CMS that exposes an MCP-compatible API, allowing AI agents to create, edit, and manage web content, data, and assets without human DevOps intervention.

## ✨ Features

- **🤖 MCP-Compatible API** - Full Model Context Protocol support for agent interaction
- **⚡ Cloudflare-Native** - Built on Workers, KV, D1, and R2 for global edge performance  
- **✏️ Inline Editing** - Add `?edit` to any URL for instant WYSIWYG editing
- **🎨 Theme System** - CSS variables and runtime theme swapping
- **📦 Zero Build** - Deploy directly with TypeScript, no complex build pipeline
- **🔗 SSR Ready** - Server-side rendering with `mono-jsx`

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install mono-jsx wrangler
# or
yarn add mono-jsx wrangler
```

### 2. Set Up Cloudflare Resources

Create the required Cloudflare resources:

```bash
# Create KV namespace
wrangler kv:namespace create "CONTENT"

# Create D1 database  
wrangler d1 create vibeflare

# Create R2 bucket
wrangler r2 bucket create your-bucket-name
```

### 3. Configure wrangler.toml

Update `wrangler.toml` with your actual resource IDs:

```toml
name = "vibeflare-mcp-server"
main = "index.ts"
compatibility_date = "2024-01-01"

kv_namespaces = [
  { binding = "CONTENT", id = "YOUR_ACTUAL_KV_ID" }
]

d1_databases = [
  { binding = "DB", database_name = "vibeflare", database_id = "YOUR_ACTUAL_D1_ID" }
]

r2_buckets = [
  { binding = "BUCKET", bucket_name = "your-actual-bucket-name" }
]
```

### 4. Deploy

```bash
wrangler publish
```

### 5. Start Creating

Visit `https://your-worker.workers.dev/?edit` and start typing!

## 📡 MCP API Reference

VibeFlare exposes a complete MCP-compatible API for programmatic content management:

### Pages

```bash
# List all pages
GET /mcp/pages
# Response: {"pages": ["home", "about", "contact"]}

# Get page content
GET /mcp/page/:slug
# Response: {"slug": "about", "content": "<h1>About</h1>..."}

# Create/update page
POST /mcp/page/:slug
Content-Type: application/json
{"content": "<h1>New Page</h1><p>Content here</p>"}
# Response: {"success": true, "slug": "about"}
```

### Data (D1 Database)

```bash
# Query table data
GET /mcp/data/:table
# Response: {"results": [...], "success": true}

# Insert data
POST /mcp/data/:table  
Content-Type: application/json
{"title": "Post Title", "content": "Post content", "author": "Agent"}
# Response: {"success": true, "result": {...}}
```

### Assets (R2 Storage)

```bash
# Upload file
POST /mcp/upload/:key
Content-Type: image/jpeg
[binary data]
# Response: {"success": true, "key": "photo.jpg"}

# Download file
GET /mcp/upload/:key
# Response: [binary data with correct Content-Type]
```

## 🎨 Theme System

Colors and styling are controlled via `theme.json` and CSS variables:

```javascript
// theme.json defines design tokens
{
  "colors": {
    "primary": "#3b82f6",
    "background": "#ffffff",
    // ...
  }
}

// Automatically converted to CSS variables:
// --color-primary: #3b82f6
// --color-background: #ffffff
```

You can swap themes at runtime by updating the CSS variables.

## ✏️ Edit Mode

Add `?edit` to any URL to enable inline editing:

- `/?edit` - Edit homepage
- `/about?edit` - Edit about page  
- `/blog/post-1?edit` - Edit blog post

The editor provides:
- **ContentEditable** regions with visual feedback
- **Save button** in top-right corner
- **Auto-save** to KV storage via `/api/save/:slug`

## 🧠 Agent Integration Examples

### Using cURL

```bash
# Create a new blog post
curl -X POST https://your-worker.workers.dev/mcp/page/blog/hello-world \
  -H "Content-Type: application/json" \
  -d '{"content": "<h1>Hello World</h1><p>My first post!</p>"}'

# Add some data
curl -X POST https://your-worker.workers.dev/mcp/data/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello World", "slug": "hello-world", "published": true}'

# Upload an image
curl -X POST https://your-worker.workers.dev/mcp/upload/hero.jpg \
  -H "Content-Type: image/jpeg" \
  --data-binary @hero.jpg
```

### Agent Prompt Examples

```
Create a landing page for a SaaS product with:
- Hero section with CTA
- Features grid
- Pricing table
- Contact form

Use the VibeFlare MCP API to:
1. POST /mcp/page/landing with the HTML content
2. POST /mcp/data/signups to create the leads table
3. Style with the existing theme variables
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   AI Agent      │───▶│ MCP API      │───▶│ Cloudflare  │
│   (Claude, etc) │    │ /mcp/*       │    │ Workers     │
└─────────────────┘    └──────────────┘    └─────────────┘
                                                   │
                       ┌─────────────┐             │
                       │ Edit Mode   │◀────────────┤
                       │ ?edit       │             │
                       └─────────────┘             │
                                                   │
                       ┌─────────────┐             │
                       │ SSR Pages   │◀────────────┤  
                       │ mono-jsx    │             │
                       └─────────────┘             │
                                                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ KV Storage  │    │ D1 Database │    │ R2 Buckets  │
│ (Pages)     │    │ (Data)      │    │ (Assets)    │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 🔒 Security Notes

This implementation focuses on core functionality. For production use, consider adding:

- **Authentication** - Cloudflare Access, API keys, or JWT tokens
- **Rate limiting** - Cloudflare rate limiting rules
- **Input validation** - Sanitize HTML content and SQL queries
- **CORS configuration** - Restrict origins for browser requests

```javascript
// Example: Add auth middleware
if (!request.headers.get('Authorization')) {
  return new Response('Unauthorized', { status: 401 });
}
```

## 🚧 Next Steps

Ready to extend VibeFlare? Consider adding:

- **React hydration** for interactive components
- **Markdown support** with frontmatter parsing
- **Image optimization** via Cloudflare Images
- **Caching strategies** with KV TTL and Cache API
- **Webhooks** for external integrations
- **Multi-tenancy** with namespace isolation

## 📖 Learning Resources

- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [mono-jsx Documentation](https://github.com/trueadm/mono-jsx)

## 🤝 Contributing

VibeFlare is designed to be extended by the community. Feel free to:

- Add new MCP endpoints
- Improve the theme system  
- Enhance the editor experience
- Build agent integrations

---

**Built with ❤️ for the agent-first web** 