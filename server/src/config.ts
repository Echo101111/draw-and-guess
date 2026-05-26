import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// Load .env from project root for local development
try {
  const possiblePaths = [
    resolve(process.cwd(), '.env'),
    resolve(fileURLToPath(import.meta.url), '../../../.env'),
  ]
  for (const envPath of possiblePaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        // Strip surrounding quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (key && !process.env[key]) {
          process.env[key] = val
        }
      }
      break
    }
  }
} catch {
  // .env not found — production / Docker
}

export const APP_VERSION = '2.0.1'

function parsePort(value: string | undefined): number {
  const parsed = parseInt(value ?? '3000', 10)
  return isNaN(parsed) ? 3000 : parsed
}

export const config = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  adminToken: process.env.ADMIN_TOKEN ?? '',
} as const
