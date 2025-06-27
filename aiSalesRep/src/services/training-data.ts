import fs from 'fs/promises';
import { AnalyzedPage } from '../types/index.js';
import { generateSensaySystemMessage } from './system-message.js';
import { loadKnowledgeBase } from './analysis-loader.js';

export async function createSensayTrainingData(companyName: string, companyDir: string, baseUrl: string, analyzedPages: AnalyzedPage[]): Promise<void> {
  const trainingDir = `${companyDir}/sensay-training`;
  await fs.mkdir(trainingDir, { recursive: true });
  await fs.mkdir(`${trainingDir}/knowledge-base`, { recursive: true });
  
  console.log('📝 Loading knowledge base for system message...');
  const knowledgeBase = await loadKnowledgeBase(companyName);
  if (!knowledgeBase) {
    throw new Error(`Knowledge base not found for ${companyName}`);
  }
  
  console.log('📝 Generating system message for training...');
  const systemMessage = generateSensaySystemMessage(companyName, baseUrl, knowledgeBase);
  await fs.writeFile(`${trainingDir}/system-message.txt`, systemMessage, 'utf8');
  
  console.log(`📚 Creating ${analyzedPages.length} knowledge base files...`);
  for (let i = 0; i < analyzedPages.length; i++) {
    const page = analyzedPages[i];
    const pageNum = String(i + 1).padStart(3, '0');
    const cleanTitle = page.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const filename = `page-${pageNum}-${cleanTitle}.md`;
    
    const content = `# ${page.title}\n\nSource: ${page.url}\n\n${page.description ? `## Description\n${page.description}\n\n` : ''}## Content\n${page.content}`;
    await fs.writeFile(`${trainingDir}/knowledge-base/${filename}`, content, 'utf8');
    console.log(`  ✅ Created: ${filename}`);
  }
  
  console.log(`✅ Sensay training data created in: ${trainingDir}`);
}

export async function regenerateTrainingData(companyName: string, baseUrl: string, analyzedPages: AnalyzedPage[]): Promise<void> {
  const companyDir = `analysis/${companyName}`;
  const trainingDir = `${companyDir}/sensay-training`;
  
  console.log(`🧹 Cleaning old training data for ${companyName}...`);
  await fs.rm(`${trainingDir}/knowledge-base`, { recursive: true, force: true });
  await fs.mkdir(`${trainingDir}/knowledge-base`, { recursive: true });
  
  console.log('📝 Loading knowledge base for system message...');
  const knowledgeBase = await loadKnowledgeBase(companyName);
  if (!knowledgeBase) {
    throw new Error(`Knowledge base not found for ${companyName}`);
  }
  
  console.log('📝 Generating system message for training...');
  const systemMessage = generateSensaySystemMessage(companyName, baseUrl, knowledgeBase);
  await fs.writeFile(`${trainingDir}/system-message.txt`, systemMessage, 'utf8');
  
  console.log(`📚 Creating ${analyzedPages.length} knowledge base files...`);
  for (let i = 0; i < analyzedPages.length; i++) {
    const page = analyzedPages[i];
    const pageNum = String(i + 1).padStart(3, '0');
    const cleanTitle = page.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const filename = `page-${pageNum}-${cleanTitle}.md`;
    
    const content = `# ${page.title}\n\nSource: ${page.url}\n\n${page.description ? `## Description\n${page.description}\n\n` : ''}## Content\n${page.content}`;
    await fs.writeFile(`${trainingDir}/knowledge-base/${filename}`, content, 'utf8');
    console.log(`  ✅ Created: ${filename}`);
  }
  
  console.log(`✅ Training data regenerated for: ${companyName}`);
}