import puppeteer from 'puppeteer';
import { PageContent } from '../types/index.js';

export async function extractPageContent(url: string): Promise<PageContent | null> {
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