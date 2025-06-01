/** 
 * MCP (Model Context Protocol) instruction generator
 * 
 * This module exports the core MCP instruction text that agents read
 * to understand how to operate VibeFlare CMS. The instructions describe:
 * - Available helper endpoints (/api/*)
 * - Data storage patterns (KV, D1, R2)
 * - Inline editing capabilities (?edit)
 */

export function generateMCPInstructions(baseUrl: string): string {
  return `# VibeFlare CMS Instructions

You are interacting with a Cloudflare-native CMS. Here's how to operate it:

## Content Management (KV Storage)
- **Pages stored with pattern**: \`page:{slug}\`
- **Create/update page**: POST ${baseUrl}/api/page/{slug}
  - Body: \`{"content": "<h1>Your HTML content</h1>"}\`
  - Example: POST ${baseUrl}/api/page/home with \`{"content": "<h1>Welcome</h1><p>Hello world!</p>"}\`

## Structured Data (D1 Database)  
- **Available tables**: posts, settings, users, comments
- **Execute SQL**: POST ${baseUrl}/api/sql
  - Body: \`{"sql": "SELECT * FROM posts WHERE published = 1"}\`
  - Example: POST ${baseUrl}/api/sql with \`{"sql": "INSERT INTO posts (title, slug, content) VALUES ('My Post', 'my-post', 'Content here')"}\`

## Assets (R2 Storage)
- **Upload file**: POST ${baseUrl}/api/upload/{key}
  - Body: Binary file data  
  - Content-Type: Appropriate MIME type (image/jpeg, text/css, etc.)
  - Example: POST ${baseUrl}/api/upload/hero.jpg with JPEG binary data
- **Access file**: GET ${baseUrl}/assets/{key}

## Inline Editing
- **Enable edit mode**: Add \`?edit\` to any page URL
- **Example**: ${baseUrl}/about?edit opens the about page in edit mode
- **Features**: ContentEditable regions, save button, auto-save

## Common Tasks

### Create a homepage:
\`\`\`bash
POST ${baseUrl}/api/page/home
{"content": "<h1>Welcome to My Site</h1><p>This is the homepage content.</p>"}
\`\`\`

### Add a blog post to database:
\`\`\`bash  
POST ${baseUrl}/api/sql
{"sql": "INSERT INTO posts (title, slug, content, published) VALUES ('My First Post', 'first-post', 'Post content here', 1)"}
\`\`\`

### Upload a stylesheet:
\`\`\`bash
POST ${baseUrl}/api/upload/styles.css
Content-Type: text/css
[CSS content as binary]
\`\`\`

### Update site styling:
\`\`\`bash
POST ${baseUrl}/api/page/styles  
{"content": ":root { --color-primary: #ff6b6b; --color-bg: #f8f9fa; }"}
\`\`\`

## Error Handling
- All endpoints return JSON with \`success\` boolean
- Failed requests include \`error\` field with description
- SQL errors include query details for debugging

## Security Notes
- This is an MVP without authentication
- In production, add Cloudflare Access or API keys
- Always validate and sanitize user input

Remember: This CMS is designed for agent operation. Feel free to create, modify, and structure content as needed!`;
}

/**
 * Default CSS variables for consistent theming
 */
export const DEFAULT_THEME = `
:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* Edit mode styles */
.edit-mode [contenteditable] {
  outline: 2px dashed var(--color-primary);
  outline-offset: 2px;
  min-height: 1.5rem;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.edit-mode [contenteditable]:focus {
  outline: 2px solid var(--color-primary);
  background: var(--color-surface);
}

.edit-save-button {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  background: var(--color-primary);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-family: var(--font-family);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  z-index: 1000;
}

.edit-save-button:hover {
  opacity: 0.9;
}
`.trim(); 