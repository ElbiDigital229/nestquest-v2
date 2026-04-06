/**
 * PM2 Ecosystem Config -- NestQuest
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production   <- start
 *   pm2 reload nestquest --update-env                 <- zero-downtime reload
 *   pm2 logs nestquest                                <- view logs
 *   pm2 monit                                         <- live monitoring dashboard
 *
 * Env vars (DATABASE_URL, SESSION_SECRET, etc.) are loaded automatically from
 * the .env file in the app directory via `import 'dotenv/config'` at the top of
 * server/index.ts -- no need to source .env before pm2 start, and vars survive
 * pm2 auto-restarts and server reboots correctly.
 *
 * Logs are written to /var/log/nestquest/ (change LOG_DIR if needed).
 */

const LOG_DIR = "/var/log/nestquest";

module.exports = {
  apps: [
    {
      name: "nestquest",
      script: "tsx",
      args: "server/index.ts",
      cwd: "/home/ubuntu/nestquest-v2",

      // Scaling -- cluster mode requires Redis for shared sessions
      exec_mode: process.env.REDIS_URL ? "cluster" : "fork",
      instances: process.env.REDIS_URL ? "max" : 1,

      // Process lifecycle
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,

      // Auto-restart
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,

      // Memory guard
      max_memory_restart: "512M",

      // Logging
      out_file: `${LOG_DIR}/out.log`,
      error_file: `${LOG_DIR}/error.log`,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Environment -- only NODE_ENV and PORT here; secrets come from .env via dotenv
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
