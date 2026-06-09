module.exports = {
  apps: [
    {
      name: "mitwpu-examcell-server",
      script: "./server/src/index.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
