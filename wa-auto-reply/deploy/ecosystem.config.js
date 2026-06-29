/**
 * PM2 process config — run from repo root on the server:
 *   pm2 start wa-auto-reply/deploy/ecosystem.config.js
 */
const path = require('path');

const appRoot = path.join(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'wa-backend',
      cwd: path.join(appRoot, 'backend'),
      script: 'index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'wa-frontend',
      cwd: path.join(appRoot, 'frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      autorestart: true,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
