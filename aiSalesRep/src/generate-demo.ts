import fs from 'fs/promises';
import { generateDemoPage } from './demo/demo-generator.js';
import { captureResponsiveScreenshots } from './crawling/crawler.js';
import { parseArgs, printHeader, handleError } from './cli/base-cli.js';

async function main() {
  const { companyName } = parseArgs();
  
  printHeader('AI Sales Rep - Demo Generator');
  
  if (!companyName) {
    console.log('📋 Available analyses:');
    const analysisDir = 'analysis';
    
    try {
      const companies = await fs.readdir(analysisDir);
      if (companies.length === 0) {
        console.log('❌ No analysis data found in the analysis/ directory.');
        process.exit(1);
      }
      
      companies.forEach((dir, index) => {
        console.log(`  ${index + 1}. ${dir}`);
      });
      
      console.log('\nUsage: npm run generate-demo <company-name>');
      console.log('Example: npm run generate-demo artzbyt-pl');
    } catch (error) {
      console.log('❌ Could not read analysis directory');
    }
    process.exit(1);
  }
  
  console.log(`🎯 Target company: ${companyName}`);
  
  try {
    const analysisDir = `analysis/${companyName}`;
    const botInfoFile = `${analysisDir}/${companyName}-sensay-bot.json`;
    const rawDataFile = `${analysisDir}/${companyName}-raw-data.json`;
    
    // Check if files exist
    try {
      await fs.access(botInfoFile);
      await fs.access(rawDataFile);
    } catch (error) {
      console.log(`❌ Missing required files for ${companyName}`);
      console.log(`Expected files:`);
      console.log(`  - ${botInfoFile}`);
      console.log(`  - ${rawDataFile}`);
      process.exit(1);
    }
    
    // Load bot and raw data
    const botInfo = JSON.parse(await fs.readFile(botInfoFile, 'utf8'));
    const rawData = JSON.parse(await fs.readFile(rawDataFile, 'utf8'));
    
    console.log(`✅ Bot found: ${botInfo.name} (ID: ${botInfo.id})`);
    console.log(`✅ Website: ${rawData.baseUrl}`);
    
    // Check if screenshots exist
    let screenshots = rawData.screenshots;
    
    if (!screenshots) {
      console.log('\n📸 Screenshots not found, capturing now...');
      const demoDir = `${analysisDir}/demo`;
      await fs.mkdir(demoDir, { recursive: true });
      
      screenshots = await captureResponsiveScreenshots(rawData.baseUrl, demoDir);
      
      if (screenshots) {
        // Update raw data with screenshots
        rawData.screenshots = screenshots;
        await fs.writeFile(rawDataFile, JSON.stringify(rawData, null, 2), 'utf8');
        console.log('✅ Screenshots captured and saved to raw data');
      } else {
        console.log('❌ Failed to capture screenshots');
        process.exit(1);
      }
    } else {
      console.log('✅ Screenshots found in raw data');
    }
    
    // Generate demo page
    console.log('\n🎨 Generating demo page...');
    const demoPath = await generateDemoPage(companyName, botInfo, rawData.baseUrl, screenshots);
    
    console.log('\n🎉 DEMO GENERATION COMPLETED!');
    console.log('===============================');
    console.log(`🎨 Demo page: ${demoPath}`);
    console.log(`🌐 Start server: npm run demo-server`);
    console.log(`🚀 View demo: http://localhost:3005/demo/${companyName}`);
    
  } catch (error) {
    handleError(error as Error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}