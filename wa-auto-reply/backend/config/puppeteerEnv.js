const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const projectCacheDir = path.join(backendRoot, '.puppeteer-cache');

const isRenderBuildCache = (value = '') =>
  String(value).includes('/opt/render/.cache');

// Render's /opt/render/.cache is build-only and is NOT available at runtime.
// Always keep Chrome inside the deployed backend folder instead.
if (!process.env.PUPPETEER_CACHE_DIR || isRenderBuildCache(process.env.PUPPETEER_CACHE_DIR)) {
  process.env.PUPPETEER_CACHE_DIR = projectCacheDir;
}

if (!fs.existsSync(process.env.PUPPETEER_CACHE_DIR)) {
  fs.mkdirSync(process.env.PUPPETEER_CACHE_DIR, { recursive: true });
}

const findChromeInCache = () => {
  const cacheDir = process.env.PUPPETEER_CACHE_DIR;
  if (!cacheDir || !fs.existsSync(cacheDir)) return null;

  const stack = [cacheDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.name === 'chrome' || entry.name === 'google-chrome' || entry.name === 'chrome-headless-shell') {
        return fullPath;
      }
    }
  }

  return null;
};

const resolveChromeExecutable = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  try {
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    if (executablePath && fs.existsSync(executablePath)) {
      return executablePath;
    }
  } catch (err) {
    console.warn(`Puppeteer executablePath lookup failed: ${err.message}`);
  }
};

module.exports = {
  projectCacheDir,
  resolveChromeExecutable,
  findChromeInCache
};
