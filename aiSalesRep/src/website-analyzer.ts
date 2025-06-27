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
  }

  async analyze(): Promise<AnalyzedPage[]> {
    console.log(`Starting analysis of: ${this.baseUrl}`);
    
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
    const screenshots = await this.captureScreenshots(companyDir);
    
    await saveResults(companyName, this.baseUrl, this.analyzedPages, this.openai, this.sensayConfig, createBot, screenshots);
  }

  getSensayConfig(): SensayConfig | null {
    return this.sensayConfig;
  }
}