import xml2js from 'xml2js';
import { URL } from 'url';

export async function fetchSitemap(baseUrl: string): Promise<string[] | null> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      throw new Error(`Sitemap not found: ${response.status}`);
    }
    
    const xmlContent = await response.text();
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    const urls: string[] = [];
    if (result.urlset && result.urlset.url) {
      result.urlset.url.forEach((urlObj: any) => {
        if (urlObj.loc && urlObj.loc[0]) {
          urls.push(urlObj.loc[0]);
        }
      });
    }
    
    return urls;
  } catch (error) {
    console.log(`Sitemap fetch failed: ${(error as Error).message}`);
    return null;
  }
}