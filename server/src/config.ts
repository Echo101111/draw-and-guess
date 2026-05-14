export const APP_VERSION = '2.0.1'

function parsePort(value: string | undefined): number {
  const parsed = parseInt(value ?? '3000', 10)
  return isNaN(parsed) ? 3000 : parsed
}

export const config = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const
