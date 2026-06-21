// Configuración de PM2 para producción (CloudPanel u otro servidor).
// Arranque:   pm2 start ecosystem.config.cjs
// Guardar:    pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'chismellm-v2',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        // CloudPanel hace reverse proxy a este puerto. Debe coincidir con
        // el "App Port" del sitio Node.js.
        PORT: 4747,
        // Detrás del proxy: escucha sólo en localhost (no exponer al exterior).
        HOST: '127.0.0.1',
      },
    },
  ],
};
