export interface PageContent {
  title: string;
  metaDescription: string;
  content: string;
}

export interface AnalyzedPage {
  url: string;
  title: string;
  description: string;
  content: string;
}

export interface SensayConfig {
  apiKey: string;
  apiUrl: string;
  organizationId: string;
  userId: string;
}

export interface SensayBot {
  id: string;
  name: string;
  systemMessage: string;
}

export interface RawData {
  baseUrl: string;
  analyzedPages: AnalyzedPage[];
  analysisDate: string;
  pageCount: number;
  screenshots?: { desktop: string; tablet: string; mobile: string } | null;
  originalCompanyName?: string | null;
}