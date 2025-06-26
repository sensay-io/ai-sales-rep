import dotenv from 'dotenv';
import { SensayConfig } from '../types/index.js';

dotenv.config();

export function initializeSensayConfig(): SensayConfig | null {
  const { SENSAY_API_KEY, SENSAY_API_URL, SENSAY_ORGANIZATION_ID, SENSAY_USER_ID } = process.env;
  
  if (SENSAY_API_KEY && SENSAY_API_URL && SENSAY_ORGANIZATION_ID && SENSAY_USER_ID) {
    return {
      apiKey: SENSAY_API_KEY,
      apiUrl: SENSAY_API_URL,
      organizationId: SENSAY_ORGANIZATION_ID,
      userId: SENSAY_USER_ID
    };
  }
  
  return null;
}