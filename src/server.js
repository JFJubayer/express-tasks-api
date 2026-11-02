import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';

createApp().listen(port, host, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Try: PORT=3001 npm start` : err.message);
    process.exit(1);
  }
  console.log(`Express Tasks API running at http://${host}:${port}`);
});
