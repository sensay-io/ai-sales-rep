import fs from 'fs/promises';
import path from 'path';
import { SensayBot } from '../types/index.js';

interface DemoPageData {
  botId: string;
  botName: string;
  websiteUrl: string;
  companyName: string;
  screenshots: {
    desktop: string;
    tablet: string;
    mobile: string;
  } | null;
}

export async function generateDemoPage(companyName: string, bot: SensayBot, websiteUrl: string, screenshotPaths: { desktop: string; tablet: string; mobile: string } | null): Promise<string> {
  const analysisDir = `analysis/${companyName}`;
  const demoDir = `${analysisDir}/demo`;
  
  // Create demo directory
  await fs.mkdir(demoDir, { recursive: true });
  
  // Copy screenshots to demo directory with web-friendly names (if available)
  let screenshots = null;
  if (screenshotPaths) {
    screenshots = {
      desktop: `${demoDir}/screenshot-desktop.png`,
      tablet: `${demoDir}/screenshot-tablet.png`,
      mobile: `${demoDir}/screenshot-mobile.png`
    };
    
    await fs.copyFile(screenshotPaths.desktop, screenshots.desktop);
    await fs.copyFile(screenshotPaths.tablet, screenshots.tablet);
    await fs.copyFile(screenshotPaths.mobile, screenshots.mobile);
  }
  
  const demoData: DemoPageData = {
    botId: bot.id,
    botName: bot.name,
    websiteUrl: websiteUrl,
    companyName: companyName,
    screenshots: screenshots ? {
      desktop: './screenshot-desktop.png',
      tablet: './screenshot-tablet.png',
      mobile: './screenshot-mobile.png'
    } : null
  };
  
  const htmlContent = generateDemoHTML(demoData);
  const demoHtmlPath = `${demoDir}/index.html`;
  
  await fs.writeFile(demoHtmlPath, htmlContent, 'utf8');
  
  console.log(`✅ Demo page generated: ${demoHtmlPath}`);
  return demoHtmlPath;
}

function generateDemoHTML(data: DemoPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.botName} - Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            overflow: hidden;
        }

        .demo-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .website-wrapper {
            flex: 1;
            position: relative;
            background: white;
            border: 1px solid #e9ecef;
            overflow: hidden;
        }

        .website-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }

        .website-screenshot {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: none;
        }

        .iframe-error {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            display: none;
            z-index: 1;
        }

        ${data.screenshots ? `
        .screenshot-desktop {
            content: url('${data.screenshots.desktop}');
        }

        .screenshot-tablet {
            content: url('${data.screenshots.tablet}');
        }

        .screenshot-mobile {
            content: url('${data.screenshots.mobile}');
        }

        /* Responsive screenshot loading */
        @media (min-width: 1024px) {
            .website-screenshot {
                content: url('${data.screenshots.desktop}');
            }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
            .website-screenshot {
                content: url('${data.screenshots.tablet}');
            }
        }

        @media (max-width: 767px) {
            .website-screenshot {
                content: url('${data.screenshots.mobile}');
            }
        }` : `
        .website-screenshot {
            display: none;
        }
        
        .website-iframe-container {
            width: 100%;
            height: 600px;
        }`}

        /* Loading overlay */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Hide loading after page load */
        .loaded .loading-overlay {
            display: none;
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <div class="website-wrapper">
            <div class="loading-overlay" id="loadingOverlay">
                <div class="loading-spinner"></div>
            </div>
            
            <iframe 
                id="websiteIframe" 
                class="website-iframe"
                src="${data.websiteUrl}"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                loading="lazy">
            </iframe>
            
            <div class="iframe-error" id="iframeError">
                <img 
                    class="website-screenshot" 
                    alt="${data.companyName} Website Preview"
                />
            </div>
        </div>
    </div>

    <!-- Embed Script -->
    <script src="https://localhost:3002/${data.botId}/embed-script.js" defer></script>

    <script>
        let iframeLoadTimeout;
        
        // Handle iframe loading
        const iframe = document.getElementById('websiteIframe');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const iframeError = document.getElementById('iframeError');
        
        // Set timeout to show screenshot if iframe doesn't load
        iframeLoadTimeout = setTimeout(() => {
            console.log('Iframe loading timeout - showing screenshot fallback');
            showScreenshotFallback();
        }, 8000);
        
        iframe.addEventListener('load', () => {
            console.log('Iframe loaded successfully');
            clearTimeout(iframeLoadTimeout);
            loadingOverlay.style.display = 'none';
            document.body.classList.add('loaded');
        });
        
        iframe.addEventListener('error', () => {
            console.log('Iframe error - showing screenshot fallback');
            clearTimeout(iframeLoadTimeout);
            showScreenshotFallback();
        });
        
        function showScreenshotFallback() {
            loadingOverlay.style.display = 'none';
            iframe.style.display = 'none';
            iframeError.style.display = 'block';
            document.body.classList.add('loaded');
            console.log('Screenshot fallback displayed');
        }
        
        // Handle window resize for responsive screenshots
        window.addEventListener('resize', () => {
            // Screenshot will automatically update via CSS media queries
        });
        
        console.log('Demo page initialized for bot: ${data.botId}');
        console.log('Website: ${data.websiteUrl}');
    </script>
</body>
</html>`;
}