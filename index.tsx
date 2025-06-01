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

    // Save API for edit mode
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
          z-index: 1000;
        }
        .btn { 
          background: var(--color-primary); color: white;
          border: none; padding: 0.5rem 1rem; border-radius: 0.25rem;
          cursor: pointer; font-size: 0.875rem;
        }
        .btn:hover { opacity: 0.9; }
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
      `;

      const editScript = `
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
            alert(data.success ? 'Saved!' : 'Error: ' + data.error);
          })
          .catch(e => alert('Save failed: ' + e.message));
        }
      `;

      if (slug === 'home') {
        // Render built-in homepage
        return (
          <html lang="en">
            <head>
              <meta charSet="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1.0" />
              <title>VibeFlare - Agent-Controlled CMS</title>
              <style>{baseStyles}</style>
              {isEditMode && (
                <script>{editScript}</script>
              )}
            </head>
            <body>
              {isEditMode && (
                <div class="edit-bar">
                  <button class="btn" onClick={() => { (window as any).saveContent(); }}>Save</button>
                  <span style="margin-left: 1rem;">Edit Mode</span>
                </div>
              )}
              <div class="container">
                <main contentEditable={isEditMode}>
                  <h1>Welcome to VibeFlare</h1>
                  <p>
                    This is an MCP-compatible CMS powered by Cloudflare Workers. 
                    Agents can control content, data, and assets through our API.
                  </p>
                  
                  <div class="mcp-info">
                    <h2>🤖 MCP Endpoints Available</h2>
                    <pre>{`GET  /mcp/pages           → list all page slugs
GET  /mcp/page/:slug      → get page content  
POST /mcp/page/:slug      → create/update page
GET  /mcp/data/:table     → query database table
POST /mcp/data/:table     → insert/update data
POST /mcp/upload/:key     → upload asset to R2
GET  /mcp/upload/:key     → download asset`}</pre>
                  </div>

                  <div class="mcp-info">
                    <h2>✏️ Quick Edit</h2>
                    <p>Add <code>?edit</code> to any URL to enable inline editing.</p>
                    <p>Try it: <a href="/?edit">Edit this page</a></p>
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
                <meta name="viewport" content="width=device-width,initial-scale=1.0" />
                <title>Page Not Found - {slug}</title>
                <style>{baseStyles}</style>
                {isEditMode && (
                  <script>{editScript}</script>
                )}
              </head>
              <body>
                {isEditMode && (
                  <div class="edit-bar">
                    <button class="btn" onClick={() => { (window as any).saveContent(); }}>Save</button>
                    <span style="margin-left: 1rem;">Edit Mode</span>
                  </div>
                )}
                <div class="container">
                  <main contentEditable={isEditMode}>
                    <h1>Page "{slug}" Not Found</h1>
                    <p>This page doesn't exist yet. You can create it using the MCP API:</p>
                    
                    <pre>{`curl -X POST https://your-worker.workers.dev/mcp/page/${slug} \\
  -H "Content-Type: application/json" \\
  -d '{"content": "<h1>New Page</h1><p>Content here</p>"}'`}</pre>
                    
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
              <meta name="viewport" content="width=device-width,initial-scale=1.0" />
              <title>{slug} - VibeFlare</title>
              <style>{baseStyles}</style>
              {isEditMode && (
                <script>{editScript}</script>
              )}
            </head>
            <body>
              {isEditMode && (
                <div class="edit-bar">
                  <button class="btn" onClick={() => { (window as any).saveContent(); }}>Save</button>
                  <span style="margin-left: 1rem;">Edit Mode</span>
                </div>
              )}
              <div class="container">
                <main 
                  contentEditable={isEditMode}
                  innerHTML={pageContent}
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