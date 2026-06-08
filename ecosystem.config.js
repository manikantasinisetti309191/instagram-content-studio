module.exports = {
  apps: [
    {
      name: 'ai-instagram-bot',
      script: 'backend/server.js',
      watch: false,
      instances: 1,
      autorestart: true,          // Restart if it crashes
      max_restarts: 10,
      restart_delay: 5000,        // Wait 5s before restarting
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
