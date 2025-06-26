import fs from 'fs/promises';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface AnalyzedPage {
  url: string;
  title: string;
  description: string;
  content: string;
}

interface RawData {
  baseUrl: string;
  analyzedPages: AnalyzedPage[];
  analysisDate: string;
  pageCount: number;
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

class BotCreator {
  private sensayConfig: SensayConfig | null;

  constructor() {
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

  async findAnalysisDirectories(): Promise<string[]> {
    try {
      const analysisDir = 'analysis';
      const entries = await fs.readdir(analysisDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      return [];
    }
  }

  async loadAnalysisData(companyName: string): Promise<RawData | null> {
    try {
      const rawDataPath = `analysis/${companyName}/${companyName}-raw-data.json`;
      const rawDataContent = await fs.readFile(rawDataPath, 'utf8');
      return JSON.parse(rawDataContent) as RawData;
    } catch (error) {
      console.error(`❌ Failed to load analysis data for ${companyName}:`, error);
      return null;
    }
  }

  generateSensaySystemMessage(companyName: string, baseUrl: string, analyzedPages: AnalyzedPage[]): string {
    const domain = baseUrl.replace(/https?:\/\//, '').replace(/\/.*$/, '');
    
    return `You are a customer service representative for ${companyName} (${domain}). Your role is to help customers with their questions about our products, services, and policies.

Key Guidelines:
- Be helpful, professional, and friendly
- Provide accurate information based on the company knowledge base
- If you don't know something, admit it and offer to connect them with human support
- Stay focused on ${companyName}-related topics
- Use the company information provided to answer questions about products, services, pricing, and policies

Company Information:
${analyzedPages.map(page => `\n**${page.title}** (${page.url})\n${page.content.substring(0, 1000)}...`).join('\n\n')}

Always maintain a helpful and professional tone while representing ${companyName}.`;
  }

  async createSensayBot(companyName: string, rawData: RawData): Promise<SensayBot | null> {
    console.log('\\n=== STARTING BOT CREATION PROCESS ===');
    
    if (!this.sensayConfig) {
      console.log('❌ Sensay configuration not found. Cannot create bot.');
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
      console.log('\\n📝 Generating system message...');
      const systemMessage = this.generateSensaySystemMessage(companyName, rawData.baseUrl, rawData.analyzedPages);
      console.log(`✅ System message generated (${systemMessage.length} characters)`);
      
      const botName = `${companyName} Customer Service Bot`;
      const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-support-bot`;
      
      console.log(`🤖 Bot name: ${botName}`);
      console.log(`🔗 Bot slug: ${slug}`);
      console.log(`📊 Using data from ${rawData.pageCount} analyzed pages`);
      console.log(`📅 Analysis date: ${rawData.analysisDate}`);
      
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
      
      console.log('\\n🚀 Creating Sensay bot...');
      console.log(`📡 Making API request to: ${this.sensayConfig.apiUrl}/v1/replicas`);
      
      const response = await axios.post(
        `${this.sensayConfig.apiUrl}/v1/replicas`,
        requestPayload,
        {
          headers: {
            'X-ORGANIZATION-SECRET': this.sensayConfig.apiKey,
            'X-USER-ID': this.sensayConfig.userId,
            'X-USER-ID-TYPE': 'user_uuid',
            'X-API-Version': '2025-03-25',
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('\\n🎉 SUCCESS! Sensay bot created successfully!');
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
      console.log('\\n❌ FAILED to create Sensay bot');
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

  async saveBotInfo(companyName: string, bot: SensayBot): Promise<void> {
    try {
      const botInfoFile = `analysis/${companyName}/${companyName}-sensay-bot.json`;
      await fs.writeFile(botInfoFile, JSON.stringify(bot, null, 2), 'utf8');
      console.log(`💾 Bot information saved to: ${botInfoFile}`);
    } catch (error) {
      console.error('❌ Failed to save bot information:', error);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const companyName = args[0];
  
  console.log('🤖 AI Sales Rep - Bot Creator');
  console.log('==============================\\n');
  
  const botCreator = new BotCreator();
  
  // If no company name provided, list available analyses
  if (!companyName) {
    console.log('📋 Available analyses:');
    const directories = await botCreator.findAnalysisDirectories();
    
    if (directories.length === 0) {
      console.log('❌ No analysis data found in the analysis/ directory.');
      console.log('💡 Run website analysis first using: npm run dev <url>');
      process.exit(1);
    }
    
    directories.forEach((dir, index) => {
      console.log(`  ${index + 1}. ${dir}`);
    });
    
    console.log('\\nUsage: npm run create-bot <company-name>');
    console.log('Example: npm run create-bot edaszek-pl');
    process.exit(1);
  }
  
  console.log(`🎯 Target company: ${companyName}`);
  
  try {
    // Load analysis data
    console.log('\\n📂 Loading analysis data...');
    const rawData = await botCreator.loadAnalysisData(companyName);
    
    if (!rawData) {
      console.log(`❌ No analysis data found for: ${companyName}`);
      console.log('💡 Available analyses:');
      const directories = await botCreator.findAnalysisDirectories();
      directories.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Loaded analysis data from ${rawData.analysisDate}`);
    console.log(`📊 ${rawData.pageCount} pages analyzed from ${rawData.baseUrl}`);
    
    // Create bot
    const bot = await botCreator.createSensayBot(companyName, rawData);
    
    if (bot) {
      // Save bot info
      await botCreator.saveBotInfo(companyName, bot);
      
      console.log('\\n🎉 BOT CREATION COMPLETED!');
      console.log('===========================');
      console.log(`🤖 Bot Name: ${bot.name}`);
      console.log(`🆔 Bot ID: ${bot.id}`);
      console.log(`📁 Analysis used: analysis/${companyName}/`);
    } else {
      console.log('\\n❌ Bot creation failed. Check the logs above for details.');
      process.exit(1);
    }
  } catch (error) {
    console.log('\\n💥 ERROR OCCURRED!');
    console.log('==================');
    console.error('❌ Error details:', (error as Error).message);
    console.error('📊 Full error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default BotCreator;