// Configuracao do PM2 para rodar o bot de forma persistente no seu PC,
// com reinicio automatico se o processo cair. Uso: npm run pm2:start
module.exports = {
  apps: [
    {
      name: "boot-ofertas",
      script: "dist/index.js",
      cwd: __dirname,
      // fork (nao cluster): so pode existir uma instancia, pois ela segura
      // a sessao unica do WhatsApp
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
