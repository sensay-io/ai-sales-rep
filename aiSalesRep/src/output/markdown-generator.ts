import { AnalyzedPage } from '../types/index.js';
import { generateBusinessSummary } from '../analysis/business-summarizer.js';
import OpenAI from 'openai';

export async function generateMarkdown(baseUrl: string, analyzedPages: AnalyzedPage[], openai: OpenAI): Promise<{ markdown: string; businessSummary: string }> {
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
  
  return { markdown, businessSummary };
}

export async function generateSuggestedQuestions(businessSummary: string, openai: OpenAI): Promise<string[]> {
  try {
    const prompt = `Based on this business summary, generate 3 example questions that customers or potential clients might ask when visiting this company's website. The questions should be relevant to the specific business type and industry.

Business Summary:
${businessSummary}

Generate exactly 3 questions that would be most helpful for customer support based on this specific business. Focus on what visitors would realistically want to know about this company's services, products, processes, or policies.

Return only the questions, one per line, without numbering or bullet points.

Questions:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [];

    return content.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.trim().replace(/^[-*•]\s*/, ''))
      .slice(0, 3);
  } catch (error) {
    console.warn('Failed to generate suggested questions:', error);
    return [];
  }
}