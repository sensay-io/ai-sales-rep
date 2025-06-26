import { RawData } from './types/index.js';
import { findAnalysisDirectories, loadAnalysisData } from './services/analysis-loader.js';
import { regenerateTrainingData } from './services/training-data.js';
import { parseArgs, printHeader, printUsage, handleError } from './cli/base-cli.js';

async function main() {
  const { companyName } = parseArgs();
  
  printHeader('AI Sales Rep - Training Data Regenerator');
  
  if (!companyName) {
    console.log('📋 Finding analyses to regenerate...');
    const directories = await findAnalysisDirectories();
    
    if (directories.length === 0) {
      console.log('❌ No analysis data found in the analysis/ directory.');
      process.exit(1);
    }
    
    console.log(`Found ${directories.length} analyses:`);
    directories.forEach((dir, index) => {
      console.log(`  ${index + 1}. ${dir}`);
    });
    
    console.log('\n🔄 Regenerating training data for all analyses...');
    
    for (const dir of directories) {
      console.log(`\n=== Processing ${dir} ===`);
      const rawData = await loadAnalysisData(dir);
      if (rawData) {
        await regenerateTrainingData(dir, rawData.baseUrl, rawData.analyzedPages);
      } else {
        console.log(`⚠️  Skipping ${dir} - no valid raw data found`);
      }
    }
    
    console.log('\n🎉 All training data regenerated!');
    return;
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
    
    await regenerateTrainingData(companyName, rawData.baseUrl, rawData.analyzedPages);
    
    console.log('\n🎉 TRAINING DATA REGENERATION COMPLETED!');
    console.log('=========================================');
    console.log(`📁 Updated: analysis/${companyName}/sensay-training/`);
  } catch (error) {
    handleError(error as Error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}