import { AnalyzedPage } from '../types/index.js';
import { generateBusinessSummary } from '../analysis/business-summarizer.js';
import OpenAI from 'openai';

export async function generateMarkdown(baseUrl: string, analyzedPages: AnalyzedPage[], openai: OpenAI): Promise<string> {
  const companyName = baseUrl.replace(/https?:\/\//, '').replace(/\/.*$/, '');
  const businessSummary = await generateBusinessSummary(analyzedPages, openai);
  
  let markdown = `# ${companyName} - Business Knowledge Base\n\n`;
  markdown += `*Generated from ${analyzedPages.length} pages analyzed on ${new Date().toISOString().split('T')[0]}*\n\n`;
  markdown += `## Business Summary\n\n${businessSummary}\n\n`;
  markdown += `---\n\n## Source Pages Analyzed\n\n`;
  
  analyzedPages.forEach((page, index) => {
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