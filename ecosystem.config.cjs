const path = require('path');

module.exports = {
  apps: [
    {
      name: 'rapor-smk-backend',
      cwd: path.join(__dirname, 'backend'),
      script: './bin/server',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        APP_ENV: 'development',
      },
    },
    {
      name: 'rapor-smk-frontend',
      cwd: path.join(__dirname, 'frontend'),
      script: 'npm',
      args: 'run dev',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
