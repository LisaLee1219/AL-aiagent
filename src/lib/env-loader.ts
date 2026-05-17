/**
 * Loads .env.local / .env and exposes configuration checks.
 */

import { isAIConfigured } from '@/lib/llm';
import { isWebSearchConfigured } from '@/lib/web-search';

let envLoaded = false;
let envLoadPromise: Promise<void> | null = null;

export async function ensureEnvLoaded(): Promise<void> {
  if (envLoaded) return;
  if (envLoadPromise) {
    await envLoadPromise;
    return;
  }
  envLoadPromise = loadEnvFiles();
  await envLoadPromise;
}

async function loadEnvFiles(): Promise<void> {
  try {
    const path = await import('path');
    const { config } = await import('dotenv');
    const root = process.cwd();
    config({ path: path.join(root, '.env.local') });
    config({ path: path.join(root, '.env') });
  } catch {
    // dotenv optional if vars already in process.env
  }
  envLoaded = true;
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
