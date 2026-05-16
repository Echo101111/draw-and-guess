// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setupRedis(io: any): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapterMod = await Function('return import("@socket.io/redis-adapter")')() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisMod = await Function('return import("redis")')() as any
    const pubClient = redisMod.createClient({ url: redisUrl })
    const subClient = pubClient.duplicate()
    await Promise.all([pubClient.connect(), subClient.connect()])
    io.adapter(adapterMod.createAdapter(pubClient, subClient))
    console.log('[Server] Redis adapter enabled (multi-node)')
    return true
  } catch (err) {
    console.warn('[Server] Redis unavailable, using in-memory mode:', (err as Error).message)
    return false
  }
}
