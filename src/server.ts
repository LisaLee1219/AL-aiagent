import { config as loadEnv } from 'dotenv';
import path from 'path';

const devEnv =
  process.env.NODE_ENV !== 'production' && process.env.COZE_PROJECT_ENV !== 'PROD';
loadEnv({ path: path.join(process.cwd(), '.env.local'), override: devEnv });
loadEnv({ path: path.join(process.cwd(), '.env'), override: devEnv });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { ensureEnvLoaded } from '@/lib/env-loader';

const dev =
  process.env.NODE_ENV !== 'production' && process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(
  process.env.PORT || process.env.DEPLOY_RUN_PORT || '5001',
  10,
);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function start() {
  // Ensure environment variables are loaded before starting
  await ensureEnvLoaded();

  await app.prepare();
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
