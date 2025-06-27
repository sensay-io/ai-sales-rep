import fs from 'fs/promises';
import { AnalyzedPage, SensayBot } from '../types/index.js';
import { generateMarkdown } from './markdown-generator.js';
import { createSensayTrainingData } from '../services/training-data.js';
import { createSensayBot } from '../sensay/bot-creator.js';
import { SensayConfig } from '../types/index.js';
import OpenAI from 'openai';

export async function saveResults(
  companyName: string, 
  baseUrl: string,
  analyzedPages: AnalyzedPage[], 
  openai: OpenAI,
  sensayConfig: SensayConfig | null,
  createBot: boolean = false,
  screenshots?: { desktop: string; tablet: string; mobile: string } | null
): Promise<void> {
  console.log('\n=== SAVING ANALYSIS RESULTS ===');
  const markdown = await generateMarkdown(baseUrl, analyzedPages, openai);
  
  const analysisDir = 'analysis';
  const companyDir = `${analysisDir}/${companyName}`;
  
  console.log(`📁 Creating directories: ${companyDir}`);
  await fs.mkdir(analysisDir, { recursive: true });
  await fs.mkdir(companyDir, { recursive: true });
  
  const analysisFile = `${companyDir}/${companyName}-knowledge-base.md`;
  console.log(`💾 Saving knowledge base to: ${analysisFile}`);
  await fs.writeFile(analysisFile, markdown, 'utf8');
  
  const rawDataFile = `${companyDir}/${companyName}-raw-data.json`;
  const rawData = {
    baseUrl: baseUrl,
    analyzedPages: analyzedPages,
    analysisDate: new Date().toISOString(),
    pageCount: analyzedPages.length,
    screenshots: screenshots
  };
  console.log(`💾 Saving raw data to: ${rawDataFile}`);
  await fs.writeFile(rawDataFile, JSON.stringify(rawData, null, 2), 'utf8');
  
  console.log('📚 Creating Sensay training data...');
  await createSensayTrainingData(companyName, companyDir, baseUrl, analyzedPages);
  
  console.log('\n✅ FILES SAVED:');
  console.log(`📄 Business knowledge base: ${analysisFile}`);
  console.log(`📊 Raw data: ${rawDataFile}`);
  if (screenshots) {
    console.log(`📸 Screenshots: ${screenshots.desktop}, ${screenshots.tablet}, ${screenshots.mobile}`);
  }
  
  if (createBot && sensayConfig) {
    console.log('\n🤖 Bot creation requested...');
    const bot = await createSensayBot(companyName, rawData, sensayConfig);
    if (bot) {
      const botInfoFile = `${companyDir}/${companyName}-sensay-bot.json`;
      console.log(`💾 Saving bot info to: ${botInfoFile}`);
      await fs.writeFile(botInfoFile, JSON.stringify(bot, null, 2), 'utf8');
      console.log(`✅ Bot information saved to: ${botInfoFile}`);
      
      // Generate demo page
      if (screenshots) {
        try {
          const { generateDemoPage } = await import('../demo/demo-generator.js');
          console.log('\n🎨 Generating demo page...');
          const demoPath = await generateDemoPage(companyName, bot, baseUrl, screenshots);
          console.log(`🎉 Demo page created: ${demoPath}`);
          console.log(`🌐 Open the demo page in your browser to test the bot!`);
        } catch (demoError) {
          console.error('⚠️  Failed to generate demo page:', demoError);
        }
      }
    } else {
      console.log('❌ Bot creation failed - no bot info to save');
    }
  } else if (createBot) {
    console.log('\n⏭️  Bot creation not possible - Sensay configuration missing');
  } else {
    console.log('\n⏭️  Bot creation not requested (use --create-bot flag)');
  }
}