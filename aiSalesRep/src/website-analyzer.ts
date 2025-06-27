import OpenAI from 'openai';
import dotenv from 'dotenv';
import { URL } from 'url';
import { AnalyzedPage, SensayConfig } from './types/index.js';
import { initializeSensayConfig } from './config/sensay-config.js';
import { fetchSitemap } from './crawling/sitemap.js';
import { crawlWebsite, captureResponsiveScreenshots } from './crawling/crawler.js';
import { extractPageContent } from './crawling/content-extractor.js';
import { analyzeWithLLM } from './analysis/llm-analyzer.js';
import { saveResults } from './output/file-manager.js';

dotenv.config();

export class WebsiteAnalyzer {
  private baseUrl: string;
  private relevantKeywords: string[];
  private analyzedPages: AnalyzedPage[];
  private openai: OpenAI;
  private sensayConfig: SensayConfig | null;
  private companyName: string | null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.relevantKeywords = [
      'product', 'services', 'offer', 'faq', 'help', 'support', 
      'delivery', 'returns', 'about', 'contact'
    ];
    this.analyzedPages = [];
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL
    });
    
    this.sensayConfig = initializeSensayConfig();
    this.companyName = null;
  }

  async analyze(): Promise<AnalyzedPage[]> {
    console.log(`Starting analysis of: ${this.baseUrl}`);
    
    console.log('🏢 Extracting company name...');
    this.companyName = await this.extractCompanyName();
    if (this.companyName) {
      console.log(`Company name: ${this.companyName}`);
    }
    
    let urls = await fetchSitemap(this.baseUrl);
    
    if (!urls) {
      console.log('Sitemap not available, crawling website...');
      urls = await crawlWebsite(this.baseUrl);
    }
    
    console.log(`Found ${urls.length} total URLs`);
    
    const relevantUrls = await analyzeWithLLM(urls, this.baseUrl, this.openai, this.relevantKeywords);
    console.log(`Processing ${relevantUrls.length} LLM-selected URLs`);
    
    for (const url of relevantUrls) {
      console.log(`Analyzing: ${url}`);
      const content = await extractPageContent(url);
      
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

  async captureScreenshots(outputDir: string): Promise<{ desktop: string; tablet: string; mobile: string } | null> {
    return await captureResponsiveScreenshots(this.baseUrl, outputDir);
  }

  async saveResults(companyName: string, createBot: boolean = false): Promise<void> {
    const analysisDir = 'analysis';
    const companyDir = `${analysisDir}/${companyName}`;
    
    console.log('\n📸 Capturing website screenshots...');
    // Ensure directory exists before capturing screenshots
    await import('fs/promises').then(fs => fs.mkdir(companyDir, { recursive: true }));
    const screenshots = await this.captureScreenshots(companyDir);
    
    await saveResults(companyName, this.baseUrl, this.analyzedPages, this.openai, this.sensayConfig, createBot, screenshots, this.companyName);
  }

  private async extractCompanyName(): Promise<string | null> {
    try {
      const homePageContent = await extractPageContent(this.baseUrl);
      if (!homePageContent) return null;

      const prompt = `Extract the marketing/brand name of the company from this website content. Return the name as it would appear in marketing materials or how customers would know the brand - avoid legal suffixes like "sp. j.", "LLC", "Inc.", etc. unless they are part of the actual brand name. Return only the company brand name, nothing else.

Website URL: ${this.baseUrl}
Page Title: ${homePageContent.title}
Meta Description: ${homePageContent.metaDescription}
Content: ${homePageContent.content.substring(0, 2000)}

Examples:
- "Apple Inc." → "Apple"
- "Microsoft Corporation" → "Microsoft"
- "Art-Zbyt sp. j." → "ArtZbyt"

Brand Name:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.warn('Failed to extract company name:', error);
      return null;
    }
  }

  getCompanyName(): string | null {
    return this.companyName;
  }

  getSensayConfig(): SensayConfig | null {
    return this.sensayConfig;
  }
}