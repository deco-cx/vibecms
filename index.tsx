/// <reference types="@cloudflare/workers-types" />
/** @jsxImportSource mono-jsx */
import themeConfig from './theme.json';

// Environment bindings interface
interface Env {
  CONTENT: KVNamespace;
  DB: D1Database;
  BUCKET: R2Bucket;
  ADMIN_SECRET?: string;
}

// MCP API handlers
async function handleMcpPages(env: Env): Promise<Response> {
  try {
    const pages = await env.CONTENT.list({ prefix: 'page:' });
    const slugs = pages.keys.map((key: any) => key.name.replace('page:', ''));
    return new Response(JSON.stringify({ pages: slugs }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleMcpPage(request: Request, env: Env, slug: string): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const content = await env.CONTENT.get(`page:${slug}`);
      if (!content) {
        return new Response(JSON.stringify({ error: 'Page not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ slug, content }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      const { content } = await request.json() as { content: string };
      await env.CONTENT.put(`page:${slug}`, content);
      return new Response(JSON.stringify({ success: true, slug }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

async function handleMcpData(request: Request, env: Env, table: string): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      const data = await request.json() as Record<string, any>;
      const columns = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);
      
      const result = await env.DB.prepare(
        `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`
      ).bind(...values).run();
      
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

async function handleMcpUpload(request: Request, env: Env, key: string): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const object = await env.BUCKET.get(key);
      if (!object) {
        return new Response('File not found', { status: 404 });
      }
      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': object.size.toString()
        }
      });
    }
    
    if (request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
      await env.BUCKET.put(key, request.body, {
        httpMetadata: { contentType }
      });
      return new Response(JSON.stringify({ success: true, key }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isEditMode = url.searchParams.has('edit');
    const isCodeMode = url.searchParams.has('code');

    // Mock env for local development
    if (!env.CONTENT) {
      console.log('No bindings found - using mock data for local development');
      env = {
        CONTENT: {
          get: async () => null,
          put: async () => {},
          list: async () => ({ keys: [] })
        } as any,
        DB: {
          prepare: () => ({
            all: async () => ({ results: [] }),
            bind: () => ({ run: async () => ({}) })
          })
        } as any,
        BUCKET: {
          get: async () => null,
          put: async () => {}
        } as any
      };
    }

    // MCP instruction endpoint - the heart of our agent-first CMS
    if (path === '/mcp') {
      const instructions = `# VibeFlare CMS Instructions

You are interacting with a Cloudflare-native CMS. Here's how to operate it:

## Content Management (KV Storage)
- **Pages stored with pattern**: \`page:{slug}\`
- **Create/update page**: POST ${url.origin}/mcp/page/{slug}
  - Body: \`{"content": "<h1>Your HTML content</h1>"}\`
  - Example: POST ${url.origin}/mcp/page/home with \`{"content": "<h1>Welcome</h1><p>Hello world!</p>"}\`

## Structured Data (D1 Database)  
- **Available tables**: posts, settings, users, comments
- **Execute SQL**: POST ${url.origin}/mcp/data/{table}
  - Body: \`{"title": "Post Title", "content": "Post content"}\`
  - Query data: GET ${url.origin}/mcp/data/{table}

## Assets (R2 Storage)
- **Upload file**: POST ${url.origin}/mcp/upload/{key}
  - Body: Binary file data  
  - Content-Type: Appropriate MIME type (image/jpeg, text/css, etc.)
- **Access file**: GET ${url.origin}/mcp/upload/{key}

## Inline Editing
- **Enable edit mode**: Add \`?edit\` to any page URL
- **Enable code mode**: Add \`?code\` to any page URL for source editing
- **Example**: ${url.origin}/about?edit opens content editing
- **Example**: ${url.origin}/about?code opens Monaco source editor

## Common Tasks

### Create a homepage:
\`\`\`bash
POST ${url.origin}/mcp/page/home
{"content": "<h1>Welcome to My Site</h1><p>This is the homepage content.</p>"}
\`\`\`

### Query all pages:
\`\`\`bash
GET ${url.origin}/mcp/pages
\`\`\`

Remember: This CMS is designed for agent operation with real-time editing capabilities!`;

      return new Response(instructions, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // MCP API routes
    if (path.startsWith('/mcp/')) {
      const segments = path.split('/').slice(2); // Remove '', 'mcp'
      
      if (segments[0] === 'pages' && segments.length === 1) {
        return handleMcpPages(env);
      }
      
      if (segments[0] === 'page' && segments.length === 2) {
        return handleMcpPage(request, env, segments[1]);
      }
      
      if (segments[0] === 'data' && segments.length === 2) {
        return handleMcpData(request, env, segments[1]);
      }
      
      if (segments[0] === 'upload' && segments.length === 2) {
        return handleMcpUpload(request, env, segments[1]);
      }
      
      return new Response('MCP endpoint not found', { status: 404 });
    }

    // Save API for both edit and code modes
    if (path.startsWith('/api/save/')) {
      const slug = path.split('/').slice(3).join('/');
      if (request.method === 'POST') {
        try {
          const { content } = await request.json() as { content: string };
          await env.CONTENT.put(`page:${slug}`, content);
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      return new Response('Method not allowed', { status: 405 });
    }

    // SSR for regular pages - using mono-jsx pattern
    const slug = path === '/' ? 'home' : path.slice(1);
    
    try {
      // Generate CSS variables from theme
      const cssVars = Object.entries(themeConfig.colors)
        .map(([key, value]) => `--color-${key}: ${value}`)
        .join('; ');

      const baseStyles = `
        :root { ${cssVars} }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: ${themeConfig.typography.fontFamily};
          background: var(--color-background);
          color: var(--color-text);
          line-height: 1.6;
        }
        .container { max-width: 1024px; margin: 0 auto; padding: 2rem; }
        .edit-bar { 
          position: fixed; top: 0; right: 0; 
          background: var(--color-primary); color: white;
          padding: 0.5rem 1rem; border-radius: 0 0 0 0.5rem;
          z-index: 1000; display: flex; gap: 0.5rem; align-items: center;
        }
        .btn { 
          background: var(--color-primary); color: white;
          border: none; padding: 0.5rem 1rem; border-radius: 0.25rem;
          cursor: pointer; font-size: 0.875rem;
        }
        .btn:hover { opacity: 0.9; }
        .btn-secondary { background: var(--color-secondary); }
        [contenteditable] { 
          outline: 2px dashed var(--color-primary); 
          outline-offset: 2px;
        }
        .mcp-info {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin: 1rem 0;
        }
        h1, h2, h3 { margin-bottom: 1rem; }
        p { margin-bottom: 1rem; }
        pre { 
          background: var(--color-surface);
          padding: 1rem;
          border-radius: 0.25rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        #monaco-editor {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 999;
          background: #1e1e1e;
        }
        .editor-hidden { display: none; }
      `;

      const editScript = `
        let editor = null;
        let originalContent = '';
        
        function saveContent() {
          const editableContent = document.querySelector('[contenteditable]');
          const slug = location.pathname === '/' ? 'home' : location.pathname.slice(1);
          
          fetch('/api/save/' + slug, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editableContent.innerHTML })
          })
          .then(r => r.json())
          .then(data => {
            alert(data.success ? 'Content saved!' : 'Error: ' + data.error);
          })
          .catch(e => alert('Save failed: ' + e.message));
        }
        
        function saveCode() {
          if (!editor) return;
          const slug = location.pathname === '/' ? 'home' : location.pathname.slice(1);
          
          fetch('/api/save/' + slug, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editor.getValue() })
          })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              alert('Code saved! Reloading...');
              location.reload();
            } else {
              alert('Error: ' + data.error);
            }
          })
          .catch(e => alert('Save failed: ' + e.message));
        }
        
        function toggleCodeEditor() {
          const editorDiv = document.getElementById('monaco-editor');
          const mainContent = document.querySelector('main');
          
          if (editorDiv.classList.contains('editor-hidden')) {
            // Show editor
            editorDiv.classList.remove('editor-hidden');
            originalContent = mainContent.innerHTML;
            
            // Load Monaco Editor
            if (!editor) {
              require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
              require(['vs/editor/editor.main'], function () {
                editor = monaco.editor.create(document.getElementById('monaco-container'), {
                  value: originalContent,
                  language: 'html',
                  theme: 'vs-dark',
                  automaticLayout: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on'
                });
              });
            } else {
              editor.setValue(originalContent);
            }
          } else {
            // Hide editor
            editorDiv.classList.add('editor-hidden');
          }
        }
        
        function closeEditor() {
          document.getElementById('monaco-editor').classList.add('editor-hidden');
        }
      `;

      if (slug === 'home') {
        // Render built-in homepage
        return (
          <html lang="en">
            <head>
              <meta charSet="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>VibeFlare - Agent-Controlled CMS</title>
              <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
              <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
              {(isEditMode || isCodeMode) && (
                <script dangerouslySetInnerHTML={{ __html: editScript }} />
              )}
            </head>
            <body>
              {(isEditMode || isCodeMode) && (
                <div class="edit-bar">
                  <button class="btn" onClick="saveContent()">Save Content</button>
                  <button class="btn btn-secondary" onClick="toggleCodeEditor()">Code Editor</button>
                  <span style="margin-left: 1rem;">Edit Mode</span>
                </div>
              )}
              
              {(isEditMode || isCodeMode) && (
                <div id="monaco-editor" class="editor-hidden">
                  <div style="position: absolute; top: 10px; right: 10px; z-index: 1001;">
                    <button class="btn" onClick="saveCode()" style="margin-right: 10px;">Save & Reload</button>
                    <button class="btn btn-secondary" onClick="closeEditor()">Close</button>
                  </div>
                  <div id="monaco-container" style="width: 100%; height: 100%;"></div>
                </div>
              )}
              
              <div class="container">
                <main contentEditable={isEditMode && !isCodeMode}>
                  <h1>Welcome to VibeFlare</h1>
                  <p>
                    This is an MCP-first CMS powered by Cloudflare Workers and mono-jsx. 
                    Agents can control content, data, and assets through our API.
                  </p>
                  
                  <div class="mcp-info">
                    <h2>🤖 MCP Endpoints Available</h2>
                    <pre dangerouslySetInnerHTML={{ __html: `GET  /mcp                 → Get MCP instructions
GET  /mcp/pages           → List all page slugs
GET  /mcp/page/:slug      → Get page content  
POST /mcp/page/:slug      → Create/update page
GET  /mcp/data/:table     → Query database table
POST /mcp/data/:table     → Insert/update data
POST /mcp/upload/:key     → Upload asset to R2
GET  /mcp/upload/:key     → Download asset` }} />
                  </div>

                  <div class="mcp-info">
                    <h2>✏️ Dual Edit Modes</h2>
                    <p>Add <code>?edit</code> for content editing or <code>?code</code> for source editing.</p>
                    <p>Try it: <a href="/?edit">Content Edit</a> | <a href="/?code">Code Edit</a></p>
                  </div>

                  <div class="mcp-info">
                    <h2>🎨 Theme System</h2>
                    <p>Colors and styling are controlled via CSS variables from theme.json</p>
                  </div>
                </main>
              </div>
            </body>
          </html>
        );
      } else {
        // Try to get page from KV
        const pageContent = await env.CONTENT.get(`page:${slug}`);
        
        if (!pageContent) {
          // Show 404 with instructions
          return (
            <html lang="en" status={404}>
              <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Page Not Found - {slug}</title>
                <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
                <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
                {(isEditMode || isCodeMode) && (
                  <script dangerouslySetInnerHTML={{ __html: editScript }} />
                )}
              </head>
              <body>
                {(isEditMode || isCodeMode) && (
                  <div class="edit-bar">
                    <button class="btn" onClick="saveContent()">Save Content</button>
                    <button class="btn btn-secondary" onClick="toggleCodeEditor()">Code Editor</button>
                    <span style="margin-left: 1rem;">Edit Mode</span>
                  </div>
                )}
                
                {(isEditMode || isCodeMode) && (
                  <div id="monaco-editor" class="editor-hidden">
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 1001;">
                      <button class="btn" onClick="saveCode()" style="margin-right: 10px;">Save & Reload</button>
                      <button class="btn btn-secondary" onClick="closeEditor()">Close</button>
                    </div>
                    <div id="monaco-container" style="width: 100%; height: 100%;"></div>
                  </div>
                )}
                
                <div class="container">
                  <main contentEditable={isEditMode && !isCodeMode}>
                    <h1>Page "{slug}" Not Found</h1>
                    <p>This page doesn't exist yet. You can create it using the MCP API:</p>
                    
                    <pre dangerouslySetInnerHTML={{ __html: `curl -X POST https://your-worker.workers.dev/mcp/page/${slug} \\
  -H "Content-Type: application/json" \\
  -d '{"content": "<h1>New Page</h1><p>Content here</p>"}'` }} />
                    
                    <p>Or <a href={`/${slug}?edit`}>start editing immediately</a></p>
                  </main>
                </div>
              </body>
            </html>
          );
        }
        
        // Render existing page
        return (
          <html lang="en">
            <head>
              <meta charSet="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>{slug} - VibeFlare</title>
              <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
              <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
              {(isEditMode || isCodeMode) && (
                <script dangerouslySetInnerHTML={{ __html: editScript }} />
              )}
            </head>
            <body>
              {(isEditMode || isCodeMode) && (
                <div class="edit-bar">
                  <button class="btn" onClick="saveContent()">Save Content</button>
                  <button class="btn btn-secondary" onClick="toggleCodeEditor()">Code Editor</button>
                  <span style="margin-left: 1rem;">Edit Mode</span>
                </div>
              )}
              
              {(isEditMode || isCodeMode) && (
                <div id="monaco-editor" class="editor-hidden">
                  <div style="position: absolute; top: 10px; right: 10px; z-index: 1001;">
                    <button class="btn" onClick="saveCode()" style="margin-right: 10px;">Save & Reload</button>
                    <button class="btn btn-secondary" onClick="closeEditor()">Close</button>
                  </div>
                  <div id="monaco-container" style="width: 100%; height: 100%;"></div>
                </div>
              )}
              
              <div class="container">
                <main 
                  contentEditable={isEditMode && !isCodeMode}
                  dangerouslySetInnerHTML={{ __html: pageContent }}
                />
              </div>
            </body>
          </html>
        );
      }
      
    } catch (error) {
      console.error('SSR Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}; 