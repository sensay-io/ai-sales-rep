import { WebsiteAnalyzer } from '../website-analyzer.js';

export function sanitizeCompanyName(companyName: string): string {
  return companyName
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and dashes
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .toLowerCase()
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
}

export async function getCompanyNameFromUrl(url: string): Promise<string> {
  const analyzer = new WebsiteAnalyzer(url);
  await analyzer.analyze();
  
  const extractedCompanyName = analyzer.getCompanyName();
  return extractedCompanyName ? 
    sanitizeCompanyName(extractedCompanyName) : 
    new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');
}

export function getCompanyNameFromAnalyzer(analyzer: WebsiteAnalyzer, url: string): string {
  const extractedCompanyName = analyzer.getCompanyName();
  return extractedCompanyName ? 
    sanitizeCompanyName(extractedCompanyName) : 
    new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');
}