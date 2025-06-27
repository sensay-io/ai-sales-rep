import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DEMO_PORT || 3005;

interface CompanyDemo {
  name: string;
  botId: string;
  websiteUrl: string;
  demoPath: string;
  screenshotPaths: {
    desktop: string;
    tablet: string;
    mobile: string;
  };
}

async function findAvailableDemos(): Promise<CompanyDemo[]> {
  const demos: CompanyDemo[] = [];
  
  try {
    const analysisDir = path.resolve(__dirname, '../../analysis');
    const companies = await fs.readdir(analysisDir);
    
    for (const company of companies) {
      const companyDir = path.join(analysisDir, company);
      
      // Skip if not a directory
      const stat = await fs.stat(companyDir);
      if (!stat.isDirectory()) continue;
      
      const demoDir = path.join(companyDir, 'demo');
      const botInfoFile = path.join(companyDir, `${company}-sensay-bot.json`);
      const rawDataFile = path.join(companyDir, `${company}-raw-data.json`);
      
      try {
        // Check if demo directory and required files exist
        await fs.access(demoDir);
        await fs.access(botInfoFile);
        await fs.access(rawDataFile);
        
        const botInfo = JSON.parse(await fs.readFile(botInfoFile, 'utf8'));
        const rawData = JSON.parse(await fs.readFile(rawDataFile, 'utf8'));
        
        if (botInfo.id && rawData.baseUrl) {
          demos.push({
            name: company,
            botId: botInfo.id,
            websiteUrl: rawData.baseUrl,
            demoPath: path.join(demoDir, 'index.html'),
            screenshotPaths: {
              desktop: path.join(demoDir, 'screenshot-desktop.png'),
              tablet: path.join(demoDir, 'screenshot-tablet.png'),
              mobile: path.join(demoDir, 'screenshot-mobile.png')
            }
          });
        }
      } catch (error) {
        // Skip companies without complete demo setup
        continue;
      }
    }
  } catch (error) {
    console.error('Error scanning for demos:', error);
  }
  
  return demos;
}

// Middleware for CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Home page - list all available demos
app.get('/', async (req, res) => {
  try {
    const demos = await findAvailableDemos();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Sales Rep - Demo Server</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8f9fa;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .header p {
            color: #7f8c8d;
            font-size: 16px;
        }
        .demo-grid {
            display: grid;
            gap: 20px;
            margin-top: 30px;
        }
        .demo-card {
            background: white;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
        }
        .demo-card h3 {
            margin: 0 0 12px 0;
            color: #2c3e50;
            font-size: 18px;
        }
        .demo-card p {
            margin: 8px 0;
            color: #6c757d;
            font-size: 14px;
        }
        .demo-card .bot-id {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        .demo-link {
            display: inline-block;
            margin-top: 12px;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        .demo-link:hover {
            background: #0056b3;
        }
        .no-demos {
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }
        .instructions {
            background: #e7f3ff;
            border: 1px solid #b8daff;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 30px;
        }
        .instructions h4 {
            margin: 0 0 8px 0;
            color: #004085;
        }
        .instructions p {
            margin: 0;
            color: #004085;
            font-size: 14px;
        }
        .instructions code {
            background: rgba(0,0,0,0.1);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Sales Rep Demo Server</h1>
        <p>Interactive demos of your sales bots in action</p>
    </div>

    ${demos.length === 0 ? `
    <div class="instructions">
        <h4>📋 How to Create Demos</h4>
        <p>To create demo pages, run: <code>npm run dev &lt;website-url&gt; --create-bot</code></p>
    </div>
    
    <div class="no-demos">
        <h3>No demos available yet</h3>
        <p>Create your first sales bot to see demos here!</p>
    </div>
    ` : `
    <div class="demo-grid">
        ${demos.map(demo => `
        <div class="demo-card">
            <h3>${demo.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
            <p><strong>Website:</strong> ${demo.websiteUrl}</p>
            <p><strong>Bot ID:</strong> <span class="bot-id">${demo.botId}</span></p>
            <a href="/demo/${demo.name}" class="demo-link" target="_blank">
                🚀 Launch Demo
            </a>
        </div>
        `).join('')}
    </div>
    `}
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Error generating home page:', error);
    res.status(500).send('Error loading demos');
  }
});

// Serve individual demo pages
app.get('/demo/:company', async (req, res) => {
  try {
    const company = req.params.company;
    const demos = await findAvailableDemos();
    const demo = demos.find(d => d.name === company);
    
    if (!demo) {
      return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Demo Not Found</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 60px; }
        h1 { color: #dc3545; }
    </style>
</head>
<body>
    <h1>🚫 Demo Not Found</h1>
    <p>The demo for "${company}" could not be found.</p>
    <a href="/">← Back to Demo List</a>
</body>
</html>`);
    }
    
    const demoHtml = await fs.readFile(demo.demoPath, 'utf8');
    res.send(demoHtml);
  } catch (error) {
    console.error('Error serving demo:', error);
    res.status(500).send('Error loading demo');
  }
});

// Serve static assets (screenshots)
app.get('/demo/:company/screenshot-:size.png', async (req, res) => {
  try {
    const { company, size } = req.params;
    
    if (!['desktop', 'tablet', 'mobile'].includes(size)) {
      return res.status(404).send('Screenshot not found');
    }
    
    const screenshotPath = path.resolve(__dirname, `../../analysis/${company}/demo/screenshot-${size}.png`);
    
    try {
      await fs.access(screenshotPath);
      res.sendFile(screenshotPath);
    } catch {
      res.status(404).send('Screenshot not found');
    }
  } catch (error) {
    console.error('Error serving screenshot:', error);
    res.status(500).send('Error loading screenshot');
  }
});

// API endpoint to get demo info
app.get('/api/demos', async (req, res) => {
  try {
    const demos = await findAvailableDemos();
    res.json(demos.map(demo => ({
      name: demo.name,
      botId: demo.botId,
      websiteUrl: demo.websiteUrl,
      demoUrl: `/demo/${demo.name}`
    })));
  } catch (error) {
    console.error('Error getting demos:', error);
    res.status(500).json({ error: 'Failed to load demos' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI Sales Rep Demo Server started!`);
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🎯 View all demos: http://localhost:${PORT}`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/demos`);
  console.log(`\n💡 Create new demos with: npm run dev <website-url> --create-bot\n`);
});