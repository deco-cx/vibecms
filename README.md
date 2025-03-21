# Vibe CMS — The Micro CMS for Agents and Vibe Coders

Vibe Coding is awesome. But configuring a CMS for your non-technical users still sucks. With Vibe CMS, you don't need to. Your agent automatically creates an embeddable CMS that your users can edit directly.

Vibe CMS is an open-source, lightweight, component-based Micro CMS built specifically for usage by code generation AI Agents. It leverages TypeScript and TSX components, offering inline content-editing combined with structured meta-configurations, perfect for embedding in agent-driven environments and custom landing-page generator agents like Lovable, Bolt.new, Replit or [deco](https://getdeco.ai).

## Core Features

### Connect your agent to the Vibe MCP (Model Context Protocol) and start using instantly

Your agent can learn how to use Vibe CMS dynamically by interacting with our hosted MCP server at https://mcp.vibecms.ai. It will then immediately be able to create sites that leverages a component library, theming, and provide a familiar editing experience for your non-technical users.

### Agents write simple TypeScript + JSX Components

Built on TSX (TypeScript JSX), your agent creates a `components/` directory with Typed components, which are great for LLMs to use later on.

// Example TSX Component with Typed Props:

```tsx
import { Component } from "vibecms";

interface MyComponentProps {
  title: string;
  description: string;
}

export const MyComponent: Component = ({ title, description }) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
};
```

Each section of a webpage is a standalone TSX component with clearly defined props, promoting maintainability and rapid development. The type definitions automatically generate appropriate content editing interfaces, eliminating the need to manually configure content type editors.

#### Server-Side Rendering with Client-Side Interactivity

Components in Vibe CMS run on the server-side by default, ensuring fast loading times and excellent SEO. For interactive elements, Vibe CMS supports client-side islands of interactivity, similar to modern frameworks like Fresh.

### Enable inline content editing for your users anywhere

Inspired by Nash, Vibe CMS provides inline, content-editable HTML outputs that your users can modify directly.

// TODO: Screenshot of embedded editor inside Lovable preview

Seamless inline editing happens directly in the browser—no external tools or complex dashboards required.

Inline forms pop-up for advanced meta-configuration (e.g., layouts, data sources, dynamic properties), making it easy for non-technical users to customize their content.

#### From Code to Collaborative Content

Dealing with "content type" editors is a headache. With Vibe CMS, you simply write React (JSX) components with TypeScript, and we automatically generate a no-code editor that matches your Props. This creates a perfect bridge between developers and content creators, allowing them to work together seamlessly in a unified environment.

### Section Library & Theming

Create your own Rich library of customizable TSX sections ready for immediate use by agents and humans.

Supports customizable themes built with Tailwind CSS, ensuring rapid styling and consistent branding.

Enables agents like Lovable and Bolt.new to easily auto-generate landing pages that remain brand-consistent and easily editable across multiple pages.

#### Component Library Architecture

The Section Library in Vibe CMS works similarly to Storybook, allowing developers to:
- Configure component properties and instantly see the generated UI
- Preview components in isolation before adding them to pages
- Create composable components that can accept other sections as parameters
- Build a cohesive design system that maintains brand consistency

### Static & Dynamic Rendering with Cloudflare Workers

Supports fully static pages (generated as HTML for instant performance).

Dynamic sections handled individually by Cloudflare Workers, allowing serverless rendering per component.

Flexible hybrid approach for maximum performance, scalability, and customizability.

### Agent-first UI compatibility - create small components that can be used inside chat experiences

Embeddable CMS designed specifically for AI agents' workflows and conversational UIs.

### Embeddable & Easy-to-Use

Lightweight, purely browser-based solution, embedding directly into any HTML file or agent workflow.

Generates clean, production-ready static HTML, ensuring fast loading times and excellent SEO.

Zero-installation editing—perfect for vibe coders, designers, marketers, and AI agents to quickly iterate and deploy.

### Open Source & Extensible

Fully open-source project, welcoming community contributions, customization, and innovation.

Easy-to-extend architecture, allowing the community and agent developers to build and share components and plugins.

## Technical Stack

**Core Technologies:**
- **TypeScript / TSX:** Provides type safety, developer productivity, and clarity
- **HTMX & Deno:** Efficient server-side rendering with minimal client-side overhead
- **Tailwind CSS & DaisyUI:** Immediate and highly customizable styling solutions
- **Cloudflare Workers:** Edge-rendered dynamic components for low latency

**Development Experience:**
- Local or web-based code editor with real-time content preview
- Automatic TypeScript to Content Schema conversion
- Git-based version control with easy rollback capabilities
- AI-assisted code and content generation

**Performance Optimizations:**
- Server-side rendering for fast initial page loads
- Minimal JavaScript footprint for better performance
- Edge computing for dynamic content with low latency
- Optimized asset delivery through CDN

## Ideal Use-Cases

**AI-Driven Web Development:**
- AI-generated, brand-consistent landing pages (e.g., Lovable-style agents)
- Rapid prototyping and iteration with AI assistance
- Embedding directly into agent chat flows for seamless, agent-driven site creation

**Content-Driven Sites:**
- Simple, high-performance, editable content sites
- Marketing landing pages with easy content management
- Documentation sites with collaborative editing

**Collaborative Workflows:**
- Bridge the gap between developers and content creators
- Enable non-technical users to make content changes without developer intervention
- Maintain brand consistency across multiple pages and sites

## Community & Learning

- Join our [Discord community](https://deco.cx/discord)
- Contribute to the [GitHub repository](https://github.com/deco-cx/vibecms)

## Get Started Today

- Connect your agent to our [MCP Server](https://mcp.vibecms.ai)
- [Quick Start Guide](https://docs.vibecms.ai/getting-started)