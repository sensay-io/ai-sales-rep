# AI Sales Rep - Website Content Extractor

A TypeScript module that extracts customer-relevant content from company websites for sales automation.

## Features

- Fetches sitemap.xml for comprehensive page discovery
- Falls back to website crawling (max 20 pages) if sitemap unavailable
- Filters pages based on sales-relevant keywords
- Extracts clean content (removes headers, footers, nav)
- Outputs structured Markdown analysis

## Installation

```bash
npm install
```

## Usage

```bash
# Development mode
npm run dev https://example.com

# Production build and run
npm run build
npm start https://example.com
```

## Output

Creates a `{domain}-analysis.md` file with:
- Company overview
- Page-by-page analysis with titles, descriptions, and content
- Clean, sales-focused content extraction

## Keywords Filtered

The module looks for pages containing: product, services, offer, faq, help, support, delivery, returns, about, contact