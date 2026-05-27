import { Router, type Router as ExpressRouter } from 'express'

export const turnRouter: ExpressRouter = Router()

turnRouter.get('/turn-config', (_req, res) => {
  const server = process.env.TURN_SERVER_URL ?? ''
  const username = process.env.TURN_USERNAME ?? ''
  const credential = process.env.TURN_CREDENTIAL ?? ''

  if (!server) {
    res.json({ url: '', username: '', credential: '' })
    return
  }

  res.json({ url: server, username, credential })
})
