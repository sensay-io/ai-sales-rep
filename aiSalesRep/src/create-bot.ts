import { SensayConfig, RawData } from './types/index.js';
import { initializeSensayConfig } from './config/sensay-config.js';
import { findAnalysisDirectories, loadAnalysisData } from './services/analysis-loader.js';
import { createSensayBot, saveBotInfo } from './sensay/bot-creator.js';
import { parseArgs, printHeader, printUsage, handleError } from './cli/base-cli.js';

async function main() {
  const { companyName } = parseArgs();
  
  printHeader('AI Sales Rep - Bot Creator');
  
  const sensayConfig = initializeSensayConfig();
  
  if (!companyName) {
    console.log('📋 Available analyses:');
    const directories = await findAnalysisDirectories();
    
    if (directories.length === 0) {
      console.log('❌ No analysis data found in the analysis/ directory.');
      console.log('💡 Run website analysis first using: npm run dev <url>');
      process.exit(1);
    }
    
    directories.forEach((dir, index) => {
      console.log(`  ${index + 1}. ${dir}`);
    });
    
    printUsage(
      'npm run create-bot <company-name>',
      'No company name provided!',
      ['npm run create-bot edaszek-pl']
    );
    process.exit(1);
  }
  
  console.log(`🎯 Target company: ${companyName}`);
  
  try {
    console.log('\n📂 Loading analysis data...');
    const rawData = await loadAnalysisData(companyName);
    
    if (!rawData) {
      console.log(`❌ No analysis data found for: ${companyName}`);
      console.log('💡 Available analyses:');
      const directories = await findAnalysisDirectories();
      directories.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Loaded analysis data from ${rawData.analysisDate}`);
    console.log(`📊 ${rawData.pageCount} pages analyzed from ${rawData.baseUrl}`);
    
    if (!sensayConfig) {
      console.log('❌ Sensay configuration not found. Cannot create bot.');
      console.log('Required environment variables:');
      console.log('  - SENSAY_API_KEY');
      console.log('  - SENSAY_API_URL'); 
      console.log('  - SENSAY_ORGANIZATION_ID');
      console.log('  - SENSAY_USER_ID');
      process.exit(1);
    }
    
    const bot = await createSensayBot(companyName, rawData, sensayConfig);
    
    if (bot) {
      await saveBotInfo(companyName, bot, rawData);
      
      console.log('\n🎉 BOT CREATION COMPLETED!');
      console.log('===========================');
      console.log(`🤖 Bot Name: ${bot.name}`);
      console.log(`🆔 Bot ID: ${bot.id}`);
      console.log(`📁 Analysis used: analysis/${companyName}/`);
    } else {
      console.log('\n❌ Bot creation failed. Check the logs above for details.');
      process.exit(1);
    }
  } catch (error) {
    handleError(error as Error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}