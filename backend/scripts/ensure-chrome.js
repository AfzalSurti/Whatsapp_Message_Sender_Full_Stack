const { execSync } = require('child_process');
const fs = require('fs');
const { resolveChromeExecutable } = require('../config/puppeteerEnv');

const forceInstall = process.env.INSTALL_PUPPETEER_CHROME === 'true';

const existingChrome = resolveChromeExecutable();
if (existingChrome && !forceInstall) {
  console.log(`Puppeteer Chrome already available at: ${existingChrome}`);
  process.exit(0);
}

console.log(`Installing Puppeteer Chrome into: ${process.env.PUPPETEER_CACHE_DIR}`);

try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: process.env
  });

  const installedPath = resolveChromeExecutable();
  if (!installedPath || !fs.existsSync(installedPath)) {
    throw new Error('Chrome install finished but executable was not found in cache');
  }

  console.log(`Puppeteer Chrome installed successfully at: ${installedPath}`);
} catch (err) {
  console.error('Failed to install Puppeteer Chrome:', err.message);
  console.warn('WhatsApp will fall back to system Chrome if available.');
  process.exit(0);
}
