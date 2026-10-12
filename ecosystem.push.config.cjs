/* global __dirname, module */
// Opt-in Staff Push dispatcher. Start only AFTER manually applying migration
// 004 and provisioning /etc/css-admin/staff-push-worker.env mode 0600.
module.exports = {
  apps: [{
    name: "css-admin-staff-push",
    cwd: __dirname,
    script: "./.worker-dist/worker/staff-push-dispatcher.js",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "350M",
    exp_backoff_restart_delay: 3000,
    time: true,
    env: { NODE_ENV: "production" },
  }],
};
