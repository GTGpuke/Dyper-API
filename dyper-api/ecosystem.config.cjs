module.exports = {
  apps: [
    {
      name: 'dyper-api',
      script: './dist/server.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
