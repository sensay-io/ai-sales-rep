import fs from 'fs/promises';
import { RawData } from '../types/index.js';

export async function findAnalysisDirectories(): Promise<string[]> {
  try {
    const analysisDir = 'analysis';
    const entries = await fs.readdir(analysisDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    return [];
  }
}

export async function loadAnalysisData(companyName: string): Promise<RawData | null> {
  try {
    const rawDataPath = `analysis/${companyName}/${companyName}-raw-data.json`;
    const rawDataContent = await fs.readFile(rawDataPath, 'utf8');
    return JSON.parse(rawDataContent) as RawData;
  } catch (error) {
    console.error(`❌ Failed to load analysis data for ${companyName}:`, error);
    return null;
  }
}