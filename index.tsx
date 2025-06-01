/// <reference types="@cloudflare/workers-types" />
/** @jsxImportSource mono-jsx */

import { generateMCPInstructions, DEFAULT_THEME } from './mcp.js';

/**
 * Cloudflare Worker environment bindings
 */
interface Env {
  CONTENT: KVNamespace;  // Pages and content storage
  DB: D1Database;        // Structured data
  BUCKET: R2Bucket;      // Binary assets
}

/**
 * Main Cloudflare Worker entry point
 * Handles MCP instructions, SSR rendering, and helper APIs
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isEditMode = url.searchParams.has('edit');
    const isCodeMode = url.searchParams.has('code');

    try {
      // MCP instruction endpoint - the heart of our agent-first CMS
      if (path === '/mcp') {
        const instructions = generateMCPInstructions(url.origin);
        return new Response(instructions, {
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // Helper API endpoints for agents
      if (path.startsWith('/api/')) {
        return handleAPI(request, env, path);
      }

      // Asset serving from R2
      if (path.startsWith('/assets/')) {
        return handleAssets(request, env, path);
      }

      // SSR page rendering with optional edit mode
      return handlePageRender(request, env, path, isEditMode, isCodeMode);

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

/**
 * Handle API endpoints for agent operations
 */
async function handleAPI(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  
  // POST /api/page/:slug - Create/update page content
  if (path.startsWith('/api/page/') && method === 'POST') {
    const slug = path.replace('/api/page/', '');
    const { content } = await request.json() as { content: string };
    
    await env.CONTENT.put(`page:${slug}`, content);
    
    return Response.json({ success: true, slug });
  }

  // POST /api/sql - Execute D1 database queries
  if (path === '/api/sql' && method === 'POST') {
    const { sql } = await request.json() as { sql: string };
    
    try {
      const result = await env.DB.prepare(sql).all();
      return Response.json({ 
        success: true, 
        results: result.results,
        meta: result.meta 
      });
    } catch (error) {
      return Response.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Database error',
        sql 
      }, { status: 400 });
    }
  }

  // POST /api/upload/:key - Upload binary assets to R2
  if (path.startsWith('/api/upload/') && method === 'POST') {
    const key = path.replace('/api/upload/', '');
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    
    await env.BUCKET.put(key, request.body, {
      httpMetadata: { contentType }
    });
    
    return Response.json({ success: true, key });
  }

  return new Response('API endpoint not found', { status: 404 });
}

/**
 * Serve assets from R2 bucket
 */
async function handleAssets(request: Request, env: Env, path: string): Promise<Response> {
  const key = path.replace('/assets/', '');
  const object = await env.BUCKET.get(key);
  
  if (!object) {
    return new Response('Asset not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
    }
  });
}

/**
 * Handle page rendering with SSR and optional edit mode
 */
async function handlePageRender(request: Request, env: Env, path: string, isEditMode: boolean, isCodeMode: boolean): Promise<Response> {
  const slug = path === '/' ? 'home' : path.slice(1);
  
  // Get page content from KV
  const content = await env.CONTENT.get(`page:${slug}`) || getDefaultPageContent(slug);
  
  // Get custom CSS theme
  const customCSS = await env.CONTENT.get('page:styles') || '';
  
  // Return JSX element directly (mono-jsx requirement)
  return PageTemplate({ 
    content, 
    isEditMode,
    isCodeMode,
    slug,
    customCSS
  });
}

/**
 * Main page template component
 */
function PageTemplate({ content, isEditMode, isCodeMode, slug, customCSS }: {
  content: string;
  isEditMode: boolean;
  isCodeMode: boolean;
  slug: string;
  customCSS: string;
}) {
  const styles = `
    ${DEFAULT_THEME}
    ${customCSS}
    
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
    
    .container { max-width: 1024px; margin: 0 auto; padding: 2rem; }
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
    let editor = null;
    let originalContent = '';
    
    function saveContent() {
      const editableContent = document.querySelector('[contenteditable]');
      const slug = location.pathname === '/' ? 'home' : location.pathname.slice(1);
      
      fetch('/api/page/' + slug, {
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
      
      fetch('/api/page/' + slug, {
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

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>VibeFlare CMS - {slug}</title>
        <style>{styles}</style>
        {(isEditMode || isCodeMode) && (
          <>
            <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
            <script>{editScript}</script>
          </>
        )}
      </head>
      <body>
        {(isEditMode || isCodeMode) && <EditModeUI />}
        {(isEditMode || isCodeMode) && <MonacoEditor />}
        
        <div class="container">
          <main contentEditable={isEditMode && !isCodeMode}>
            {content === getDefaultPageContent('home') && slug === 'home' ? (
              <HomePage />
            ) : content === getDefaultPageContent(slug) && content.includes("doesn't exist yet") ? (
              <NotFoundPage slug={slug} />
            ) : (
              <div>{content}</div>
            )}
          </main>
        </div>
      </body>
    </html>
  );
}

/**
 * Edit mode UI component
 */
function EditModeUI() {
  return (
    <div class="edit-bar">
      <button class="btn" onClick={() => (window as any).saveContent()}>
        Save Content
      </button>
      <button class="btn btn-secondary" onClick={() => (window as any).toggleCodeEditor()}>
        Code Editor
      </button>
      <span style={{ marginLeft: '1rem' }}>Edit Mode</span>
    </div>
  );
}

/**
 * Monaco editor overlay
 */
function MonacoEditor() {
  return (
    <div id="monaco-editor" class="editor-hidden">
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1001 }}>
        <button 
          class="btn" 
          onClick={() => (window as any).saveCode()} 
          style={{ marginRight: '10px' }}
        >
          Save & Reload
        </button>
        <button class="btn btn-secondary" onClick={() => (window as any).closeEditor()}>
          Close
        </button>
      </div>
      <div id="monaco-container" style={{ width: '100%', height: '100%' }}></div>
    </div>
  );
}

/**
 * Homepage component
 */
function HomePage() {
  return (
    <>
      <h1>Welcome to VibeFlare</h1>
      <p>
        This is an MCP-first CMS powered by Cloudflare Workers and mono-jsx. 
        Agents can control content, data, and assets through our API.
      </p>
      
      <div class="mcp-info">
        <h2>🤖 MCP Endpoints Available</h2>
        <pre>{`GET  /mcp                 → Get MCP instructions
GET  /mcp/pages           → List all page slugs  
POST /api/page/{slug}     → Create/update page
POST /api/sql             → Execute D1 queries
POST /api/upload/{key}    → Upload assets to R2
GET  /assets/{key}        → Access uploaded assets`}</pre>
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
    </>
  );
}

/**
 * 404 page component
 */
function NotFoundPage({ slug }: { slug: string }) {
  return (
    <>
      <h1>Page "{slug}" Not Found</h1>
      <p>This page doesn't exist yet. You can create it using the MCP API:</p>
      
      <pre>{`curl -X POST https://your-worker.workers.dev/api/page/${slug} \\
  -H "Content-Type: application/json" \\
  -d '{"content": "<h1>New Page</h1><p>Content here</p>"}'`}</pre>
      
      <p>Or <a href={`/${slug}?edit`}>start editing immediately</a></p>
    </>
  );
}

/**
 * Default content for new pages
 */
function getDefaultPageContent(slug: string): string {
  const welcomeContent = {
    home: `
      <h1>Welcome to VibeFlare</h1>
      <p>This is your agent-controlled CMS powered by Cloudflare Workers.</p>
      <p>Add <code>?edit</code> to this URL to start editing, or visit <a href="/mcp">/mcp</a> to see the agent instructions.</p>
    `,
    about: `
      <h1>About</h1>
      <p>This page was created automatically. Add <code>?edit</code> to customize it.</p>
    `
  };

  return welcomeContent[slug as keyof typeof welcomeContent] || `
    <h1>Page: ${slug}</h1>
    <p>This page doesn't exist yet. Add <code>?edit</code> to create content!</p>
  `;
} 