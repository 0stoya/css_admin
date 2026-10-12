/* global __dirname, module */
// Start only AFTER applying deploy/postgres/002_admin_export_jobs.sql
// and configuring /etc/css-admin/export-worker.env (0600).
module.exports = {
  apps: [
    {
      name: "css-admin-export-worker",
      cwd: __dirname,
      script: "./.worker-dist/worker/export-jobs.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "900M",
      exp_backoff_restart_delay: 3000,
      time: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
