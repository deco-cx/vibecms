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
      return handlePageRender(request, env, path, isEditMode);

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
async function handlePageRender(request: Request, env: Env, path: string, isEditMode: boolean): Promise<Response> {
  const slug = path === '/' ? 'home' : path.slice(1);
  
  // Get page content from KV
  const content = await env.CONTENT.get(`page:${slug}`) || getDefaultPageContent(slug);
  
  // Get custom CSS theme
  const customCSS = await env.CONTENT.get('page:styles') || '';
  
  // Create page HTML with inline styles and scripts
  const pageHTML = generatePageHTML(content, isEditMode, slug, customCSS);
  
  return new Response(pageHTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Generate complete HTML page with inline styles and scripts
 */
function generatePageHTML(content: string, isEditMode: boolean, slug: string, customCSS: string): string {
  const editScript = isEditMode ? `
    <script>
      async function saveContent(slug) {
        const content = document.querySelector('main [contenteditable]').innerHTML;
        
        try {
          const response = await fetch('/api/page/' + slug, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          
          const result = await response.json();
          
          if (result.success) {
            alert('Content saved successfully!');
          } else {
            alert('Error saving: ' + result.error);
          }
        } catch (error) {
          alert('Network error: ' + error.message);
        }
      }
      
      // Auto-save every 30 seconds
      setInterval(() => {
        if (document.querySelector('main [contenteditable]')?.innerHTML.trim()) {
          saveContent('${slug}');
        }
      }, 30000);
    </script>
  ` : '';

  const editButton = isEditMode ? `
    <button 
      class="edit-save-button"
      onclick="saveContent('${slug}')"
    >
      Save
    </button>
  ` : '';

  const mainContent = isEditMode 
    ? `<div contenteditable="true">${content}</div>`
    : `<div>${content}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VibeFlare CMS</title>
    <style>${DEFAULT_THEME}</style>
    ${customCSS ? `<style>${customCSS}</style>` : ''}
  </head>
  <body class="${isEditMode ? 'edit-mode' : ''}">
    <main>${mainContent}</main>
    ${editButton}
    ${editScript}
  </body>
</html>`;
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