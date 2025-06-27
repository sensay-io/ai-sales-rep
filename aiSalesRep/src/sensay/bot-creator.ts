import axios from 'axios';
import fs from 'fs/promises';
import { SensayConfig, SensayBot, RawData } from '../types/index.js';
import { generateSensaySystemMessage } from '../services/system-message.js';
import { generateDemoPage } from '../demo/demo-generator.js';
import { loadKnowledgeBase } from '../services/analysis-loader.js';

export async function createSensayBot(companyName: string, rawData: RawData, sensayConfig: SensayConfig): Promise<SensayBot | null> {
  console.log('\n=== STARTING BOT CREATION PROCESS ===');
  
  console.log('✅ Sensay configuration found');
  console.log(`📋 Organization ID: ${sensayConfig.organizationId}`);
  console.log(`👤 User ID: ${sensayConfig.userId}`);
  console.log(`🔗 API URL: ${sensayConfig.apiUrl}`);
  
  try {
    console.log('\n📝 Loading knowledge base...');
    const knowledgeBase = await loadKnowledgeBase(companyName);
    
    if (!knowledgeBase) {
      console.log(`❌ No knowledge base found for: ${companyName}`);
      console.log('💡 Make sure the analysis has been completed and knowledge base file exists');
      return null;
    }
    
    console.log(`✅ Knowledge base loaded (${knowledgeBase.length} characters)`);
    
    console.log('\n📝 Generating system message...');
    const systemMessage = generateSensaySystemMessage(companyName, rawData.baseUrl, knowledgeBase);
    console.log(`✅ System message generated (${systemMessage.length} characters)`);
    
    const displayName = rawData.originalCompanyName || companyName;
    const slug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-support-bot`;
    
    console.log(`🤖 Bot name: ${displayName}`);
    console.log(`🔗 Bot slug: ${slug}`);
    console.log(`📊 Using data from ${rawData.pageCount} analyzed pages`);
    console.log(`📅 Analysis date: ${rawData.analysisDate}`);
    
    const requestPayload = {
      name: displayName,
      shortDescription: `Demo of the customer support bot for ${displayName}.`,
      greeting: `Hello and welcome! This is a demo version of the ${displayName} support bot. You’re now testing how the bot works. Please note: I’ve been trained only on information available from your company’s public website. How can I assist you today?`,
      ownerID: sensayConfig.userId,
      slug: slug,
      llm: {
        systemMessage,
        model: 'gpt-4o'
      },
      private: false,
      ...(rawData.suggestedQuestions && rawData.suggestedQuestions.length > 0 && {
        suggestedQuestions: rawData.suggestedQuestions
      })
    };

    console.log('requestPayload', requestPayload);
    
    console.log('\n🚀 Creating Sensay bot...');
    console.log(`📡 Making API request to: ${sensayConfig.apiUrl}/v1/replicas`);
    
    const response = await axios.post(
      `${sensayConfig.apiUrl}/v1/replicas`,
      requestPayload,
      {
        headers: {
          'X-ORGANIZATION-SECRET': sensayConfig.apiKey,
          'X-API-Version': '2025-03-25',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n🎉 SUCCESS! Sensay bot created successfully!');
    console.log(`✅ Bot name: ${displayName}`);
    console.log(`🆔 Bot ID: ${response.data.uuid}`);
    console.log(`📊 Response status: ${response.status}`);
    
    return {
      id: response.data.uuid,
      name: displayName,
      systemMessage: systemMessage
    };
  } catch (error) {
    console.log('\n❌ FAILED to create Sensay bot');
    console.error('💥 Error details:', error);
    
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.log(`📊 HTTP Status: ${axiosError.response?.status}`);
      console.log(`📋 Status Text: ${axiosError.response?.statusText}`);
      console.log('📄 API Error Response:', JSON.stringify(axiosError.response?.data, null, 2));
      
      if (axiosError.response?.status === 401) {
        console.log('🔑 This looks like an authentication error. Check your SENSAY_API_KEY.');
      }
      if (axiosError.response?.status === 403) {
        console.log('🚫 This looks like a permissions error. Check your user permissions.');
      }
      if (axiosError.response?.status === 400) {
        console.log('📝 This looks like a bad request error. Check the request payload.');
      }
    }
    return null;
  }
}

export async function saveBotInfo(companyName: string, bot: SensayBot, rawData?: any): Promise<void> {
  try {
    const botInfoFile = `analysis/${companyName}/${companyName}-sensay-bot.json`;
    await fs.writeFile(botInfoFile, JSON.stringify(bot, null, 2), 'utf8');
    console.log(`💾 Bot information saved to: ${botInfoFile}`);
    
    // Generate demo page if screenshots are available
    if (rawData?.screenshots && rawData?.baseUrl) {
      try {
        console.log('\n🎨 Generating demo page...');
        const demoPath = await generateDemoPage(
          companyName, 
          bot, 
          rawData.baseUrl, 
          rawData.screenshots
        );
        console.log(`🎉 Demo page created: ${demoPath}`);
        console.log(`🌐 Open the demo page in your browser to test the bot!`);
      } catch (demoError) {
        console.error('⚠️  Failed to generate demo page:', demoError);
      }
    }
  } catch (error) {
    console.error('❌ Failed to save bot information:', error);
  }
}