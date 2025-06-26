import fs from 'fs/promises';
import dotenv from 'dotenv';

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

class TrainingDataRegenerator {
  
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

  async regenerateTrainingData(companyName: string, rawData: RawData): Promise<void> {
    const companyDir = `analysis/${companyName}`;
    const trainingDir = `${companyDir}/sensay-training`;
    
    // Clean and recreate knowledge base directory
    console.log(`🧹 Cleaning old training data for ${companyName}...`);
    await fs.rm(`${trainingDir}/knowledge-base`, { recursive: true, force: true });
    await fs.mkdir(`${trainingDir}/knowledge-base`, { recursive: true });
    
    // Generate system message
    console.log('📝 Generating system message for training...');
    const systemMessage = this.generateSensaySystemMessage(companyName, rawData.baseUrl, rawData.analyzedPages);
    await fs.writeFile(`${trainingDir}/system-message.txt`, systemMessage, 'utf8');
    
    // Create knowledge base files with cleaner filenames
    console.log(`📚 Creating ${rawData.analyzedPages.length} knowledge base files...`);
    for (let i = 0; i < rawData.analyzedPages.length; i++) {
      const page = rawData.analyzedPages[i];
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
    
    console.log(`✅ Training data regenerated for: ${companyName}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const companyName = args[0];
  
  console.log('🔄 AI Sales Rep - Training Data Regenerator');
  console.log('============================================\\n');
  
  const regenerator = new TrainingDataRegenerator();
  
  // If no company name provided, list available analyses and regenerate all
  if (!companyName) {
    console.log('📋 Finding analyses to regenerate...');
    const directories = await regenerator.findAnalysisDirectories();
    
    if (directories.length === 0) {
      console.log('❌ No analysis data found in the analysis/ directory.');
      process.exit(1);
    }
    
    console.log(`Found ${directories.length} analyses:`);
    directories.forEach((dir, index) => {
      console.log(`  ${index + 1}. ${dir}`);
    });
    
    console.log('\\n🔄 Regenerating training data for all analyses...');
    
    for (const dir of directories) {
      console.log(`\\n=== Processing ${dir} ===`);
      const rawData = await regenerator.loadAnalysisData(dir);
      if (rawData) {
        await regenerator.regenerateTrainingData(dir, rawData);
      } else {
        console.log(`⚠️  Skipping ${dir} - no valid raw data found`);
      }
    }
    
    console.log('\\n🎉 All training data regenerated!');
    return;
  }
  
  console.log(`🎯 Target company: ${companyName}`);
  
  try {
    // Load analysis data
    console.log('\\n📂 Loading analysis data...');
    const rawData = await regenerator.loadAnalysisData(companyName);
    
    if (!rawData) {
      console.log(`❌ No analysis data found for: ${companyName}`);
      console.log('💡 Available analyses:');
      const directories = await regenerator.findAnalysisDirectories();
      directories.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Loaded analysis data from ${rawData.analysisDate}`);
    console.log(`📊 ${rawData.pageCount} pages analyzed from ${rawData.baseUrl}`);
    
    // Regenerate training data
    await regenerator.regenerateTrainingData(companyName, rawData);
    
    console.log('\\n🎉 TRAINING DATA REGENERATION COMPLETED!');
    console.log('=========================================');
    console.log(`📁 Updated: analysis/${companyName}/sensay-training/`);
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

export default TrainingDataRegenerator;