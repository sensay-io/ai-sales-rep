import OpenAI from 'openai';
import { isRelevantUrl } from '../crawling/crawler.js';

export async function analyzeWithLLM(urls: string[], baseUrl: string, openai: OpenAI, relevantKeywords: string[]): Promise<string[]> {
  console.log('Using LLM to identify relevant pages...');
  
  const urlList = urls.slice(0, 50).join('\n');
  const prompt = `Analyze this list of URLs from a business website and identify the most relevant pages for customer support representative to answer questions about the company's products, services, and policies.

Look for pages like:
- Products/services pages
- FAQ/help/support pages
- About us/company information
- Pricing/offers
- Contact information
- Terms of service/policies
- Case studies/testimonials

Website: ${baseUrl}

URLs to analyze:
${urlList}

Return ONLY the most relevant URLs (max 15), one per line, without any explanations or additional text:`;

  try {
    const response = await openai.chat.completions.create({
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
    return urls.filter(url => isRelevantUrl(url, relevantKeywords)).slice(0, 15);
  }
}