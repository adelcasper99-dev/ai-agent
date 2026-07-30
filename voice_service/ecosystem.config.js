module = module || {};
module.exports = {
  apps: [
    {
      name: "casper-voice-agent",
      script: "agent.py",
      args: "start",
      interpreter: "python",
      cwd: "./",
      autorestart: true,
      watch: false,
      max_restarts: 50,
      restart_delay: 2000,
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        NODE_ENV: "production",
      },
      out_file: "./agent_pm2.log",
      error_file: "./agent_pm2_err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
