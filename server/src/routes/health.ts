import { Router, type Router as ExpressRouter } from 'express'

export const healthRouter: ExpressRouter = Router()

healthRouter.get('/', (_req: unknown, res: { json: (data: { status: string; timestamp: number }) => void }) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})
