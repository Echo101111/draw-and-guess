import { createHmac } from 'crypto'
import { Router, type Router as ExpressRouter } from 'express'

export const turnRouter: ExpressRouter = Router()

turnRouter.get('/turn-config', (_req, res) => {
  const url = process.env.TURN_SERVER_URL ?? ''
  const secret = process.env.TURN_CREDENTIAL ?? ''

  if (!url || !secret) {
    res.json({ url: '', username: '', credential: '' })
    return
  }

  // Time-limited credential: coturn 使用 HMAC-SHA1 验证
  // username = <expiry-timestamp>:<username>
  // credential = base64(hmac-sha1(secret, username))
  const expiry = Math.floor(Date.now() / 1000) + 43200 // 12 小时
  const username = `${expiry}:party-game`
  const credential = createHmac('sha1', secret)
    .update(username)
    .digest()
    .toString('base64')

  res.json({ url, username, credential })
})
