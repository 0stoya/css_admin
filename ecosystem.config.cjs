/* global __dirname, module, process */

const port = process.env.CSS_ADMIN_PORT?.trim() || "3067";

if (!/^\d+$/.test(port)) {
  throw new Error("CSS_ADMIN_PORT must be a numeric TCP port.");
}

module.exports = {
  apps: [
    {
      name: "css-admin",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: ["start", "--hostname", "127.0.0.1", "--port", port],
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
