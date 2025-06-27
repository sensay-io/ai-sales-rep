import puppeteer from 'puppeteer';
import { URL } from 'url';

export function isRelevantUrl(url: string, relevantKeywords: string[]): boolean {
  const urlLower = url.toLowerCase();
  return relevantKeywords.some(keyword => 
    urlLower.includes(keyword) || urlLower.includes(`/${keyword}`)
  );
}

export async function crawlWebsite(baseUrl: string, maxPages: number = 20): Promise<string[]> {
  console.log('Starting website crawl...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const urlsToVisit = [baseUrl];
  const foundUrls = new Set([baseUrl]);
  const visitedUrls = new Set<string>();
  
  try {
    while (urlsToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlsToVisit.shift()!;
      
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);
      
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
            const baseUrlObj = new URL(baseUrl);
            
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

export async function captureResponsiveScreenshots(baseUrl: string, outputDir: string): Promise<{ desktop: string; tablet: string; mobile: string } | null> {
  console.log(`📸 Capturing responsive screenshots of: ${baseUrl}`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const screenSizes = [
    { name: 'desktop', width: 1200, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 }
  ];
  
  const screenshots: { [key: string]: string } = {};
  
  try {
    for (const size of screenSizes) {
      console.log(`📱 Capturing ${size.name} screenshot (${size.width}x${size.height})`);
      
      await page.setViewport({ width: size.width, height: size.height });
      await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 15000 });
      
      const outputPath = `${outputDir}/screenshot-${size.name}.png`;
      await page.screenshot({
        path: outputPath,
        fullPage: false,
        type: 'png'
      });
      
      screenshots[size.name] = outputPath;
      console.log(`✅ ${size.name} screenshot saved: ${outputPath}`);
    }
    
    return screenshots as { desktop: string; tablet: string; mobile: string };
  } catch (error) {
    console.log(`❌ Failed to capture screenshots: ${(error as Error).message}`);
    return null;
  } finally {
    await browser.close();
  }
}