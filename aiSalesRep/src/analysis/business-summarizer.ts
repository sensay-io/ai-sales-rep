import OpenAI from 'openai';
import { AnalyzedPage } from '../types/index.js';

export async function generateBusinessSummary(analyzedPages: AnalyzedPage[], openai: OpenAI): Promise<string> {
  if (analyzedPages.length === 0) {
    return 'No content available for analysis.';
  }

  const contentSummary = analyzedPages.map(page => 
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
    const response = await openai.chat.completions.create({
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