# VibeFlare MCP-First CMS 🚀

**Agent-controlled CMS powered by Cloudflare Workers and the Model Context Protocol (MCP)**

VibeFlare is a Cloudflare-native CMS that exposes a **single MCP endpoint** (`GET /mcp`) which provides AI agents with complete instructions on how to create, edit, and manage web content, data, and assets. Think of it as "Lovable's edit flow meets raw Cloudflare power via MCP."

## 🧠 What is "MCP-First"?

Unlike traditional CMSs with dozens of REST endpoints, VibeFlare follows the **Model Context Protocol** philosophy:

1. **One endpoint to rule them all**: `GET /mcp` returns plain-text instructions
2. **Agent reads instructions**: Claude, deco.chat, or any MCP client learns your system
3. **Agent performs real work**: Calls the helper endpoints described in the instructions
4. **Zero API documentation needed**: The MCP response IS the documentation

```
Agent: "Create a blog post about AI"
  ↓
GET /mcp (reads instructions)
  ↓  
POST /api/page/blog/ai-post (creates content)
  ↓
POST /api/sql (adds to database)
  ↓
Done! ✨
```

## ✨ Features

- **🤖 True MCP Protocol** - Single instruction endpoint, not fake REST APIs
- **⚡ Cloudflare-Native** - Workers + KV + D1 + R2 for global edge performance
- **✏️ Inline Editing** - Add `?edit` to any URL for instant WYSIWYG editing
- **🎨 Theme System** - CSS variables for consistent styling
- **📦 Zero Build** - Deploy directly with TypeScript, no complex pipeline
- **🔗 SSR Ready** - Server-side rendering with `mono-jsx`

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install mono-jsx wrangler
```

### 2. **Development Mode (Local Storage)**

For local development with automatic fallbacks:

```bash
# Use local storage for all services (recommended for development)
npm run dev

# This will create local files in .wrangler/state for:
# - KV: Local key-value storage
# - D1: Local SQLite database 
# - R2: Local filesystem storage
```

### 3. **Production Setup (Cloudflare Resources)**

Only needed when deploying to production:

```bash
# Create KV namespace for pages
wrangler kv:namespace create "CONTENT"

# Create D1 database for structured data
wrangler d1 create vibeflare

# Create R2 bucket for assets
wrangler r2 bucket create your-bucket-name
```

### 4. Update wrangler.toml

Replace the placeholder IDs with your actual resource IDs:

```toml
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

### 5. Deploy

```bash
wrangler publish
```

### 6. Start Using

Visit `https://your-worker.workers.dev/mcp` to see the MCP instructions, or add `?edit` to any page URL for inline editing!

## 📡 How MCP Works

The magic happens at `/mcp` which returns instructions like this:

```
# VibeFlare CMS Instructions

## Content Management
- Pages stored in KV with key pattern: `page:{slug}`
- Create/update via: POST /api/page/{slug} with {content: "html"}
- Enable editing by adding ?edit to any URL

## Structured Data  
- Database tables in D1: posts, settings, users
- Execute SQL via: POST /api/sql with {sql: "SELECT * FROM posts"}

## Assets
- Binary files in R2 bucket
- Upload via: POST /api/upload/{key} with binary body
- Access at: GET /assets/{key}

## Examples
- Create homepage: POST /api/page/home {"content": "<h1>Welcome</h1>"}
- Add blog post: POST /api/sql {"sql": "INSERT INTO posts (title, slug) VALUES ('Hello', 'hello')"}
- Upload image: POST /api/upload/hero.jpg [binary data]
```

Any MCP-capable agent reads these instructions and knows exactly how to operate your CMS!

## ✏️ Inline Editing

Add `?edit` to any URL to enable WYSIWYG editing:

- `/?edit` - Edit homepage
- `/about?edit` - Edit about page
- `/blog/my-post?edit` - Edit blog post

The editor provides:
- **ContentEditable** regions with visual feedback
- **Save button** that POSTs to `/api/page/:slug`
- **Auto-save** to prevent data loss

## 🎨 Styling

VibeFlare uses CSS variables for theming:

```css
:root {
  --color-primary: #3b82f6;
  --color-background: #ffffff;
  --color-text: #1f2937;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
}
```

Agents can update styles by modifying the CSS stored in KV under the `styles` key.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   AI Agent      │───▶│ GET /mcp     │───▶│ Cloudflare  │
│   (Claude, etc) │    │ (instructions)    │ Workers     │
└─────────────────┘    └──────────────┘    └─────────────┘
                                                   │
                       ┌─────────────┐             │
                       │ Helper APIs │◀────────────┤
                       │ /api/*      │             │
                       └─────────────┘             │
                                                   │
                       ┌─────────────┐             │
                       │ SSR Pages   │◀────────────┤  
                       │ ?edit mode  │             │
                       └─────────────┘             │
                                                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ KV Storage  │    │ D1 Database │    │ R2 Buckets  │
│ (Pages)     │    │ (Data)      │    │ (Assets)    │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 🔒 Security Notes

This MVP focuses on core MCP functionality. For production, add:

- **Authentication** - Cloudflare Access or API keys
- **Rate limiting** - Cloudflare rate limiting rules  
- **Input validation** - Sanitize HTML and SQL
- **CORS configuration** - Restrict origins

```javascript
// TODO: Add auth middleware here
// if (!request.headers.get('Authorization')) {
//   return new Response('Unauthorized', { status: 401 });
// }
```

## 🚧 Next Steps

Ready to extend VibeFlare? Consider adding:

- **Authentication** with Cloudflare Access integration
- **Multi-tenancy** with namespace isolation per user
- **Caching strategies** using KV TTL and Cache API
- **Webhooks** for external system notifications
- **React hydration** for interactive components
- **Image optimization** via Cloudflare Images
- **Markdown support** with frontmatter parsing
- **Version control** for content history
- **Backup/restore** functionality
- **Template system** for reusable layouts

## 📖 Resources

- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [mono-jsx](https://github.com/trueadm/mono-jsx)

---

**Built with ❤️ for the agent-first web** 