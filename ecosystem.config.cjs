// pm2 start ecosystem.config.cjs   (settings come from .env)
module.exports = {
  apps: [
    {
      name: 'tiny-math',
      script: 'server/index.ts',
      interpreter: 'node',
      node_args: '--env-file-if-exists=.env --disable-warning=ExperimentalWarning',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1, // SQLite: keep a single process
      autorestart: true,
      max_memory_restart: '300M',
      time: true,
    },
  ],
}
