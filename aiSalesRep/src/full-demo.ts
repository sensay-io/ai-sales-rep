import { URL } from 'url';
import { WebsiteAnalyzer } from './website-analyzer.js';
import { parseArgs, printHeader, handleError } from './cli/base-cli.js';
import { getCompanyNameFromAnalyzer } from './services/company-name.js';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

function openBrowser(url: string): void {
  const start = process.platform === 'darwin' ? 'open' : 
                process.platform === 'win32' ? 'start' : 'xdg-open';
  
  spawn(start, [url], { detached: true, stdio: 'ignore' });
}

async function startDemoServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\n🚀 Starting demo server...');
    
    const serverProcess = spawn('npm', ['run', 'demo-server'], {
      stdio: 'pipe',
      detached: false
    });

    let serverStarted = false;
    
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('Server running at:') && !serverStarted) {
        serverStarted = true;
        console.log('✅ Demo server is ready!');
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverStarted) {
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

async function main() {
  const { url } = parseArgs();
  
  printHeader('AI Sales Rep - Full Demo Workflow');
  
  if (!url) {
    console.log('❌ No URL provided!');
    console.log('\nUsage: npm run full-demo -- <website-url>');
    console.log('Example: npm run full-demo -- https://example.com');
    process.exit(1);
  }
  
  console.log(`🌐 Target URL: ${url}`);
  console.log('🎯 Full workflow: Crawl → Generate Bot → Start Server → Open Browser');
  console.log('');
  
  try {
    // Step 1: Website Analysis
    console.log('📊 STEP 1: Website Analysis');
    console.log('============================');
    const analyzer = new WebsiteAnalyzer(url);
    await analyzer.analyze();
    
    const companyName = getCompanyNameFromAnalyzer(analyzer, url);
    
    console.log(`✅ Analysis completed for: ${companyName}`);
    
    // Step 2: Save Results & Create Bot
    console.log('\n🤖 STEP 2: Bot Creation');
    console.log('=======================');
    await analyzer.saveResults(companyName, true); // Force bot creation
    
    if (!analyzer.getSensayConfig()) {
      console.log('⚠️  Bot creation failed - missing Sensay configuration');
      console.log('   Please set these environment variables:');
      console.log('   - SENSAY_API_KEY');
      console.log('   - SENSAY_API_URL');
      console.log('   - SENSAY_ORGANIZATION_ID');
      console.log('   - SENSAY_USER_ID');
      process.exit(1);
    }
    
    console.log('✅ Bot creation completed!');
    
    // Step 3: Start Demo Server
    console.log('\n🌐 STEP 3: Demo Server');
    console.log('======================');
    
    // Give a moment for files to be written
    await sleep(2000);
    
    await startDemoServer();
    
    // Step 4: Open Browser
    console.log('\n🚀 STEP 4: Opening Demo');
    console.log('========================');
    
    const demoUrl = `http://localhost:3005/demo/${companyName}`;
    console.log(`🌍 Opening browser to: ${demoUrl}`);
    
    // Wait a moment for server to be fully ready
    await sleep(3000);
    
    openBrowser(demoUrl);
    
    console.log('\n🎉 WORKFLOW COMPLETE!');
    console.log('=====================');
    console.log(`✅ Website analyzed: ${url}`);
    console.log(`✅ Bot created for: ${companyName}`);
    console.log(`✅ Demo server running: http://localhost:3005`);
    console.log(`✅ Demo page opened: ${demoUrl}`);
    console.log('\n💡 The demo server will keep running. Press Ctrl+C to stop it.');
    
  } catch (error) {
    handleError(error as Error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}