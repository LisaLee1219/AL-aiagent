/**
 * Loads .env.local / .env and exposes configuration checks.
 */

import { isAIConfigured } from '@/lib/llm';
import { isWebSearchConfigured } from '@/lib/web-search';

let envLoaded = false;
let envLoadPromise: Promise<void> | null = null;

const isDevRuntime = () =>
  process.env.NODE_ENV !== 'production' && process.env.COZE_PROJECT_ENV !== 'PROD';

export async function ensureEnvLoaded(): Promise<void> {
  // In dev, re-read .env.local so key changes apply without restarting the server.
  if (envLoaded && !isDevRuntime()) return;
  if (envLoadPromise && !isDevRuntime()) {
    await envLoadPromise;
    return;
  }
  envLoadPromise = loadEnvFiles();
  await envLoadPromise;
  if (!isDevRuntime()) envLoaded = true;
}

async function loadEnvFiles(): Promise<void> {
  try {
    const path = await import('path');
    const { config } = await import('dotenv');
    const root = process.cwd();
    const override = isDevRuntime();
    config({ path: path.join(root, '.env.local'), override });
    config({ path: path.join(root, '.env'), override });
  } catch {
    // dotenv optional if vars already in process.env
  }
}

export function isBCConfiguredCheck(): boolean {
  return !!(
    process.env.BC_ODATA_URL &&
    process.env.BC_USERNAME &&
    process.env.BC_PASSWORD
  );
}

export function isAIConfiguredCheck(): boolean {
  return isAIConfigured();
}

export function isWebSearchConfiguredCheck(): boolean {
  return isWebSearchConfigured();
}
