/**
 * PM2 Ecosystem Config — NestQuest
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          ← start
 *   pm2 reload nestquest --update-env       ← zero-downtime reload
 *   pm2 logs nestquest                      ← view logs
 *   pm2 monit                               ← live monitoring dashboard
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

      // ── Scaling ──────────────────────────────────────
      // "cluster" mode forks one worker per CPU core.
      // All workers share the same port via the OS. Sessions must be in Redis
      // (not in-process) for cluster mode to work correctly.
      exec_mode: process.env.REDIS_URL ? "cluster" : "fork",
      instances: process.env.REDIS_URL ? "max" : 1,

      // ── Process lifecycle ─────────────────────────────
      // Wait for the app to be listening before treating it as ready.
      wait_ready: true,
      listen_timeout: 10000,    // ms to wait for ready signal
      kill_timeout: 5000,       // ms to wait before force-killing on reload

      // ── Auto-restart ──────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",         // must stay alive 5s to count as a successful start
      restart_delay: 2000,      // wait 2s between restarts (avoid restart loops)

      // ── Memory guard ─────────────────────────────────
      // Restart if the process leaks memory past 512MB.
      max_memory_restart: "512M",

      // ── Logging ──────────────────────────────────────
      out_file: `${LOG_DIR}/out.log`,
      error_file: `${LOG_DIR}/error.log`,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Keep 30 days of logs (requires pm2-logrotate module)
      // pm2 install pm2-logrotate

      // ── Environment ──────────────────────────────────
      // Production env vars are loaded from /home/ubuntu/nestquest/.env
      // (sourced before pm2 start in deploy.sh) — do NOT hardcode secrets here.
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
