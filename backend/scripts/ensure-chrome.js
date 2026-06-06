const { execSync } = require('child_process');

const shouldInstall =
  Boolean(process.env.RENDER) ||
  process.env.INSTALL_PUPPETEER_CHROME === 'true' ||
  (process.platform === 'linux' && process.env.NODE_ENV === 'production');

if (!shouldInstall) {
  console.log('Skipping Puppeteer Chrome install (local/dev environment).');
  process.exit(0);
}

console.log('Installing Puppeteer Chrome for headless WhatsApp...');

try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer'
    }
  });
  console.log('Puppeteer Chrome installed successfully.');
} catch (err) {
  console.error('Failed to install Puppeteer Chrome:', err.message);
  process.exit(1);
}
