// pm2 process definition for the family health dashboard web app.
module.exports = {
  apps: [
    {
      name: "health-web",
      cwd: "/opt/health/web",
      script: "npm",
      args: "start",
      env: {
        PORT: "3100",
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
