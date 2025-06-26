import puppeteer, { Browser, Page } from 'puppeteer';
import xml2js from 'xml2js';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { URL } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';

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

interface SensayConfig {
  apiKey: string;
  apiUrl: string;
  organizationId: string;
  userId: string;
}

interface SensayBot {
  id: string;
  name: string;
  systemMessage: string;
}

class WebsiteAnalyzer {
  private baseUrl: string;
  private relevantKeywords: string[];
  private analyzedPages: AnalyzedPage[];
  private visitedUrls: Set<string>;
  private openai: OpenAI;
  private sensayConfig: SensayConfig | null;

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
    
    // Initialize Sensay config if credentials are provided
    this.sensayConfig = this.initializeSensayConfig();
  }
  
  private initializeSensayConfig(): SensayConfig | null {
    const { SENSAY_API_KEY, SENSAY_API_URL, SENSAY_ORGANIZATION_ID, SENSAY_USER_ID } = process.env;
    
    if (SENSAY_API_KEY && SENSAY_API_URL && SENSAY_ORGANIZATION_ID && SENSAY_USER_ID) {
      return {
        apiKey: SENSAY_API_KEY,
        apiUrl: SENSAY_API_URL,
        organizationId: SENSAY_ORGANIZATION_ID,
        userId: SENSAY_USER_ID
      };
    }
    
    return null;
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

  generateSensaySystemMessage(companyName: string): string {
    const domain = this.baseUrl.replace(/https?:\/\//, '').replace(/\/.*$/, '');
    
    return `You are a customer service representative for ${companyName} (${domain}). Your role is to help customers with their questions about our products, services, and policies.

Key Guidelines:
- Be helpful, professional, and friendly
- Provide accurate information based on the company knowledge base
- If you don't know something, admit it and offer to connect them with human support
- Stay focused on ${companyName}-related topics
- Use the company information provided to answer questions about products, services, pricing, and policies

Company Information:
${this.analyzedPages.map(page => `\n**${page.title}** (${page.url})\n${page.content.substring(0, 1000)}...`).join('\n\n')}

Always maintain a helpful and professional tone while representing ${companyName}.`;
  }
  
  async createSensayTrainingData(companyName: string, companyDir: string): Promise<void> {
    // Create training data directory structure
    const trainingDir = `${companyDir}/sensay-training`;
    await fs.mkdir(trainingDir, { recursive: true });
    await fs.mkdir(`${trainingDir}/knowledge-base`, { recursive: true });
    
    // Generate system message
    console.log('📝 Generating system message for training...');
    const systemMessage = this.generateSensaySystemMessage(companyName);
    await fs.writeFile(`${trainingDir}/system-message.txt`, systemMessage, 'utf8');
    
    // Create knowledge base files with cleaner filenames
    console.log(`📚 Creating ${this.analyzedPages.length} knowledge base files...`);
    for (let i = 0; i < this.analyzedPages.length; i++) {
      const page = this.analyzedPages[i];
      // Create cleaner filename: page-001-title.md instead of long ugly names
      const pageNum = String(i + 1).padStart(3, '0');
      const cleanTitle = page.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50); // Limit to 50 chars
      const filename = `page-${pageNum}-${cleanTitle}.md`;
      
      const content = `# ${page.title}\n\nSource: ${page.url}\n\n${page.description ? `## Description\n${page.description}\n\n` : ''}## Content\n${page.content}`;
      await fs.writeFile(`${trainingDir}/knowledge-base/${filename}`, content, 'utf8');
      console.log(`  ✅ Created: ${filename}`);
    }
    
    console.log(`✅ Sensay training data created in: ${trainingDir}`);
  }
  
  async createSensayBot(companyName: string): Promise<SensayBot | null> {
    console.log('\n=== STARTING BOT CREATION PROCESS ===');
    
    if (!this.sensayConfig) {
      console.log('❌ Sensay configuration not found. Skipping bot creation.');
      console.log('Required environment variables:');
      console.log('  - SENSAY_API_KEY');
      console.log('  - SENSAY_API_URL'); 
      console.log('  - SENSAY_ORGANIZATION_ID');
      console.log('  - SENSAY_USER_ID');
      return null;
    }
    
    console.log('✅ Sensay configuration found');
    console.log(`📋 Organization ID: ${this.sensayConfig.organizationId}`);
    console.log(`👤 User ID: ${this.sensayConfig.userId}`);
    console.log(`🔗 API URL: ${this.sensayConfig.apiUrl}`);
    
    try {
      console.log('\n📝 Generating system message...');
      const systemMessage = this.generateSensaySystemMessage(companyName);
      console.log(`✅ System message generated (${systemMessage.length} characters)`);
      
      const botName = `${companyName} Customer Service Bot`;
      const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-support-bot`;
      
      console.log(`🤖 Bot name: ${botName}`);
      console.log(`🔗 Bot slug: ${slug}`);
      
      const requestPayload = {
        name: botName,
        shortDescription: `Customer service bot for ${companyName}`,
        greeting: `Hi! I'm the ${companyName} customer service assistant. How can I help you today?`,
        ownerID: this.sensayConfig.userId,
        slug: slug,
        llm: {
          systemPrompt: systemMessage,
          model: 'gpt-4o-mini'
        }
      };
      
      console.log('\n🚀 Creating Sensay bot...');
      console.log(`📡 Making API request to: ${this.sensayConfig.apiUrl}/v1/replicas`);
      
      const response = await axios.post(
        `${this.sensayConfig.apiUrl}/v1/replicas`,
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.sensayConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('\n🎉 SUCCESS! Sensay bot created successfully!');
      console.log(`✅ Bot name: ${botName}`);
      console.log(`🆔 Bot ID: ${response.data.uuid}`);
      console.log(`🔗 Bot URL: https://sensay.io/replicas/${slug}`);
      console.log(`📊 Response status: ${response.status}`);
      
      return {
        id: response.data.uuid,
        name: botName,
        systemMessage: systemMessage
      };
    } catch (error) {
      console.log('\n❌ FAILED to create Sensay bot');
      console.error('💥 Error details:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.log(`📊 HTTP Status: ${axiosError.response?.status}`);
        console.log(`📋 Status Text: ${axiosError.response?.statusText}`);
        console.log('📄 API Error Response:', JSON.stringify(axiosError.response?.data, null, 2));
        
        if (axiosError.response?.status === 401) {
          console.log('🔑 This looks like an authentication error. Check your SENSAY_API_KEY.');
        }
        if (axiosError.response?.status === 403) {
          console.log('🚫 This looks like a permissions error. Check your user permissions.');
        }
        if (axiosError.response?.status === 400) {
          console.log('📝 This looks like a bad request error. Check the request payload.');
        }
      }
      return null;
    }
  }
  
  async saveResults(companyName: string, createBot: boolean = false): Promise<void> {
    console.log('\n=== SAVING ANALYSIS RESULTS ===');
    const markdown = await this.generateMarkdown();
    
    // Create analysis directory structure
    const analysisDir = 'analysis';
    const companyDir = `${analysisDir}/${companyName}`;
    
    console.log(`📁 Creating directories: ${companyDir}`);
    await fs.mkdir(analysisDir, { recursive: true });
    await fs.mkdir(companyDir, { recursive: true });
    
    // Save main analysis file
    const analysisFile = `${companyDir}/${companyName}-knowledge-base.md`;
    console.log(`💾 Saving knowledge base to: ${analysisFile}`);
    await fs.writeFile(analysisFile, markdown, 'utf8');
    
    // Save raw data as JSON for potential future use
    const rawDataFile = `${companyDir}/${companyName}-raw-data.json`;
    const rawData = {
      baseUrl: this.baseUrl,
      analyzedPages: this.analyzedPages,
      analysisDate: new Date().toISOString(),
      pageCount: this.analyzedPages.length
    };
    console.log(`💾 Saving raw data to: ${rawDataFile}`);
    await fs.writeFile(rawDataFile, JSON.stringify(rawData, null, 2), 'utf8');
    
    // Create Sensay training data
    console.log('📚 Creating Sensay training data...');
    await this.createSensayTrainingData(companyName, companyDir);
    
    console.log('\n✅ FILES SAVED:');
    console.log(`📄 Business knowledge base: ${analysisFile}`);
    console.log(`📊 Raw data: ${rawDataFile}`);
    
    // Create Sensay bot if requested
    if (createBot) {
      console.log('\n🤖 Bot creation requested...');
      const bot = await this.createSensayBot(companyName);
      if (bot) {
        // Save bot info
        const botInfoFile = `${companyDir}/${companyName}-sensay-bot.json`;
        console.log(`💾 Saving bot info to: ${botInfoFile}`);
        await fs.writeFile(botInfoFile, JSON.stringify(bot, null, 2), 'utf8');
        console.log(`✅ Bot information saved to: ${botInfoFile}`);
      } else {
        console.log('❌ Bot creation failed - no bot info to save');
      }
    } else {
      console.log('\n⏭️  Bot creation not requested (use --create-bot flag)');
    }
  }
}

export default WebsiteAnalyzer;

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  const createBot = args.includes('--create-bot');
  
  console.log('🚀 AI Sales Rep - Website Analysis Tool');
  console.log('=====================================\n');
  
  if (!url) {
    console.log('❌ No URL provided!');
    console.log('\nUsage: npm run dev <website-url> [--create-bot]');
    console.log('Examples:');
    console.log('  npm run dev https://example.com');
    console.log('  npm run dev https://example.com --create-bot');
    process.exit(1);
  }
  
  console.log(`🌐 Target URL: ${url}`);
  console.log(`🤖 Create bot: ${createBot ? 'YES' : 'NO'}`);
  console.log('');
  
  try {
    console.log('🔧 Initializing analyzer...');
    const analyzer = new WebsiteAnalyzer(url);
    
    console.log('🔍 Starting website analysis...');
    await analyzer.analyze();
    
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const companyName = domain.replace(/\./g, '-');
    
    console.log(`✅ Analysis completed for: ${companyName}`);
    
    await analyzer.saveResults(companyName, createBot);
    
    console.log('\n🎉 ALL DONE!');
    console.log('=============');
    console.log(`📁 Results saved to: analysis/${companyName}/`);
    
    if (createBot) {
      if (analyzer['sensayConfig']) {
        console.log('🤖 Bot creation process completed! Check logs above for status.');
      } else {
        console.log('⚠️  Bot creation requested but Sensay configuration missing.');
        console.log('   Please set these environment variables in your .env file:');
        console.log('   - SENSAY_API_KEY');
        console.log('   - SENSAY_API_URL');
        console.log('   - SENSAY_ORGANIZATION_ID');
        console.log('   - SENSAY_USER_ID');
      }
    }
  } catch (error) {
    console.log('\n💥 ERROR OCCURRED!');
    console.log('==================');
    console.error('❌ Error details:', (error as Error).message);
    console.error('📊 Full error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}