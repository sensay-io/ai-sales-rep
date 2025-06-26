import { URL } from 'url';
import { WebsiteAnalyzer } from './website-analyzer.js';
import { parseArgs, printHeader, printUsage, handleError } from './cli/base-cli.js';

async function main() {
  const { url, createBot } = parseArgs();
  
  printHeader('AI Sales Rep - Website Analysis Tool');
  
  if (!url) {
    printUsage(
      'npm run dev <website-url> [--create-bot]',
      'No URL provided!',
      [
        'npm run dev https://example.com',
        'npm run dev https://example.com --create-bot'
      ]
    );
    process.exit(1);
  }
  
  console.log(`🌐 Target URL: ${url}`);
  console.log(`🤖 Create bot: ${createBot ? 'YES' : 'NO'}`);
  console.log('');
  
  try {
    console.log('🔧 Initializing analyzer...');
    const analyzer = new WebsiteAnalyzer(url);
    
    console.log('🔍 Starting website analysis...');
    await analyzer.analyze();
    
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const companyName = domain.replace(/\./g, '-');
    
    console.log(`✅ Analysis completed for: ${companyName}`);
    
    await analyzer.saveResults(companyName, createBot);
    
    console.log('\n🎉 ALL DONE!');
    console.log('=============');
    console.log(`📁 Results saved to: analysis/${companyName}/`);
    
    if (createBot) {
      if (analyzer.getSensayConfig()) {
        console.log('🤖 Bot creation process completed! Check logs above for status.');
      } else {
        console.log('⚠️  Bot creation requested but Sensay configuration missing.');
        console.log('   Please set these environment variables in your .env file:');
        console.log('   - SENSAY_API_KEY');
        console.log('   - SENSAY_API_URL');
        console.log('   - SENSAY_ORGANIZATION_ID');
        console.log('   - SENSAY_USER_ID');
      }
    }
  } catch (error) {
    handleError(error as Error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}