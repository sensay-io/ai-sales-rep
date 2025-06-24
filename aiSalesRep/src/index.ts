import puppeteer, { Browser, Page } from 'puppeteer';
import xml2js from 'xml2js';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { URL } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

interface PageContent {
  title: string;
  metaDescription: string;
  content: string;
}

interface AnalyzedPage {
  url: string;
  title: string;
  description: string;
  content: string;
}

class WebsiteAnalyzer {
  private baseUrl: string;
  private relevantKeywords: string[];
  private analyzedPages: AnalyzedPage[];
  private visitedUrls: Set<string>;
  private openai: OpenAI;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.relevantKeywords = [
      'product', 'services', 'offer', 'faq', 'help', 'support', 
      'delivery', 'returns', 'about', 'contact'
    ];
    this.analyzedPages = [];
    this.visitedUrls = new Set();
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL
    });
  }

  async fetchSitemap(): Promise<string[] | null> {
    try {
      const sitemapUrl = new URL('/sitemap.xml', this.baseUrl).href;
      const response = await fetch(sitemapUrl);
      
      if (!response.ok) {
        throw new Error(`Sitemap not found: ${response.status}`);
      }
      
      const xmlContent = await response.text();
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlContent);
      
      const urls: string[] = [];
      if (result.urlset && result.urlset.url) {
        result.urlset.url.forEach((urlObj: any) => {
          if (urlObj.loc && urlObj.loc[0]) {
            urls.push(urlObj.loc[0]);
          }
        });
      }
      
      return urls;
    } catch (error) {
      console.log(`Sitemap fetch failed: ${(error as Error).message}`);
      return null;
    }
  }

  private isRelevantUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    return this.relevantKeywords.some(keyword => 
      urlLower.includes(keyword) || urlLower.includes(`/${keyword}`)
    );
  }

  async crawlWebsite(maxPages: number = 20): Promise<string[]> {
    console.log('Starting website crawl...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const urlsToVisit = [this.baseUrl];
    const foundUrls = new Set([this.baseUrl]);
    
    try {
      while (urlsToVisit.length > 0 && this.visitedUrls.size < maxPages) {
        const currentUrl = urlsToVisit.shift()!;
        
        if (this.visitedUrls.has(currentUrl)) continue;
        this.visitedUrls.add(currentUrl);
        
        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 10000 });
          
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map(a => (a as HTMLAnchorElement).href)
              .filter(href => href.startsWith('http'));
          });
          
          links.forEach(link => {
            try {
              const linkUrl = new URL(link);
              const baseUrlObj = new URL(this.baseUrl);
              
              if (linkUrl.hostname === baseUrlObj.hostname && !foundUrls.has(link)) {
                foundUrls.add(link);
                urlsToVisit.push(link);
              }
            } catch (e) {
              // Invalid URL, skip
            }
          });
          
        } catch (error) {
          console.log(`Error crawling ${currentUrl}: ${(error as Error).message}`);
        }
      }
    } finally {
      await browser.close();
    }
    
    return Array.from(foundUrls);
  }

  async extractPageContent(url: string): Promise<PageContent | null> {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const content = await page.evaluate(() => {
        const title = document.querySelector('title')?.textContent?.trim() || 
                     document.querySelector('h1')?.textContent?.trim() || '';
        
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        
        const removeSelectors = [
          'header', 'nav', 'footer', '.header', '.nav', '.footer', 
          '.navigation', '.menu', '.sidebar', 'aside', '.ads', '.advertisement'
        ];
        
        removeSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        const mainContent = document.querySelector('main')?.textContent ||
                           document.querySelector('article')?.textContent ||
                           document.querySelector('.content')?.textContent ||
                           document.querySelector('#content')?.textContent ||
                           document.body?.textContent || '';
        
        return {
          title,
          metaDescription,
          content: mainContent.replace(/\s+/g, ' ').trim()
        };
      });
      
      return content;
    } catch (error) {
      console.log(`Error extracting content from ${url}: ${(error as Error).message}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  async analyzeWithLLM(urls: string[]): Promise<string[]> {
    console.log('Using LLM to identify relevant pages...');
    
    const urlList = urls.slice(0, 50).join('\n');
    const prompt = `Analyze this list of URLs from a business website and identify the most relevant pages for understanding the company's business, products, services, and customer support.

Look for pages like:
- Products/services pages
- FAQ/help/support pages
- About us/company information
- Pricing/offers
- Contact information
- Terms of service/policies
- Case studies/testimonials

Website: ${this.baseUrl}

URLs to analyze:
${urlList}

Return ONLY the most relevant URLs (max 15), one per line, without any explanations or additional text:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000
      });

      const relevantUrls = response.choices[0]?.message?.content
        ?.split('\n')
        .filter(url => url.trim() && url.startsWith('http'))
        .slice(0, 15) || [];

      console.log(`LLM identified ${relevantUrls.length} relevant URLs`);
      return relevantUrls;
    } catch (error) {
      console.error('LLM analysis failed, falling back to keyword matching:', error);
      return urls.filter(url => this.isRelevantUrl(url)).slice(0, 15);
    }
  }

  async generateBusinessSummary(): Promise<string> {
    if (this.analyzedPages.length === 0) {
      return 'No content available for analysis.';
    }

    const contentSummary = this.analyzedPages.map(page => 
      `URL: ${page.url}\nTitle: ${page.title}\nContent: ${page.content.substring(0, 1500)}`
    ).join('\n\n---\n\n');

    const prompt = `Analyze the following website content and create a comprehensive business summary for a chatbot knowledge base.

Provide:
1. Company Overview (what they do, mission, key value propositions)
2. Products/Services (detailed descriptions, features, benefits)
3. Target Audience (who they serve)
4. Key Information (pricing, policies, contact details)
5. FAQ Insights (common questions and answers)
6. Support Information (how customers can get help)

Website Content:
${contentSummary}

Format the response as a structured markdown document suitable for a customer service chatbot:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000
      });

      return response.choices[0]?.message?.content || 'Failed to generate business summary.';
    } catch (error) {
      console.error('Failed to generate business summary:', error);
      return 'Failed to generate business summary due to LLM error.';
    }
  }

  async analyze(): Promise<AnalyzedPage[]> {
    console.log(`Starting analysis of: ${this.baseUrl}`);
    
    let urls = await this.fetchSitemap();
    
    if (!urls) {
      console.log('Sitemap not available, crawling website...');
      urls = await this.crawlWebsite();
    }
    
    console.log(`Found ${urls.length} total URLs`);
    
    const relevantUrls = await this.analyzeWithLLM(urls);
    console.log(`Processing ${relevantUrls.length} LLM-selected URLs`);
    
    for (const url of relevantUrls) {
      console.log(`Analyzing: ${url}`);
      const content = await this.extractPageContent(url);
      
      if (content && content.content.length > 100) {
        this.analyzedPages.push({
          url,
          title: content.title,
          description: content.metaDescription,
          content: content.content.substring(0, 3000)
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.analyzedPages;
  }

  async generateMarkdown(): Promise<string> {
    const companyName = this.baseUrl.replace(/https?:\/\//, '').replace(/\/.*$/, '');
    const businessSummary = await this.generateBusinessSummary();
    
    let markdown = `# ${companyName} - Business Knowledge Base\n\n`;
    markdown += `*Generated from ${this.analyzedPages.length} pages analyzed on ${new Date().toISOString().split('T')[0]}*\n\n`;
    markdown += `## Business Summary\n\n${businessSummary}\n\n`;
    markdown += `---\n\n## Source Pages Analyzed\n\n`;
    
    this.analyzedPages.forEach((page, index) => {
      markdown += `### ${index + 1}. ${page.title || 'Untitled Page'}\n`;
      markdown += `**URL**: ${page.url}\n`;
      if (page.description) {
        markdown += `**Description**: ${page.description}\n`;
      }
      markdown += `\n#### Key Content:\n`;
      markdown += `${page.content.substring(0, 1000)}...\n\n`;
      markdown += `---\n\n`;
    });
    
    return markdown;
  }

  async saveResults(companyName: string): Promise<void> {
    const markdown = await this.generateMarkdown();
    
    // Create analysis directory structure
    const analysisDir = 'analysis';
    const companyDir = `${analysisDir}/${companyName}`;
    
    await fs.mkdir(analysisDir, { recursive: true });
    await fs.mkdir(companyDir, { recursive: true });
    
    // Save main analysis file
    const analysisFile = `${companyDir}/${companyName}-knowledge-base.md`;
    await fs.writeFile(analysisFile, markdown, 'utf8');
    
    // Save raw data as JSON for potential future use
    const rawDataFile = `${companyDir}/${companyName}-raw-data.json`;
    const rawData = {
      baseUrl: this.baseUrl,
      analyzedPages: this.analyzedPages,
      analysisDate: new Date().toISOString(),
      pageCount: this.analyzedPages.length
    };
    await fs.writeFile(rawDataFile, JSON.stringify(rawData, null, 2), 'utf8');
    
    console.log(`Business knowledge base saved to: ${analysisFile}`);
    console.log(`Raw data saved to: ${rawDataFile}`);
  }
}

export default WebsiteAnalyzer;

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('Usage: npm run dev <website-url>');
    console.log('Example: npm run dev https://example.com');
    process.exit(1);
  }
  
  try {
    const analyzer = new WebsiteAnalyzer(url);
    await analyzer.analyze();
    
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const companyName = domain.replace(/\./g, '-');
    
    await analyzer.saveResults(companyName);
    console.log(`\nAnalysis complete! Check analysis/${companyName}/ for results.`);
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}