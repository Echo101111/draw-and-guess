import { Router, type Request, type Response } from 'express'

export interface FeedbackEntry {
  text: string
  timestamp: number
}

export const feedbackStore: FeedbackEntry[] = []

export const feedbackRouter: Router = Router()

const feedbackRateLimit = new Map<string, number>()

feedbackRouter.post('/', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'

  // 每 IP 每 10 秒只能提交一次
  const last = feedbackRateLimit.get(ip)
  const now = Date.now()
  if (last && now - last < 10000) {
    res.status(429).json({ success: false, message: '提交过于频繁，请稍后再试' })
    return
  }
  feedbackRateLimit.set(ip, now)

  const { text } = req.body as { text?: string }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ success: false, message: '请输入反馈内容' })
    return
  }

  if (text.length > 1000) {
    res.status(400).json({ success: false, message: '反馈内容不能超过1000字' })
    return
  }

  feedbackStore.push({ text: text.trim(), timestamp: now })
  // 最多保留 1000 条，超出时移除最早的一半
  if (feedbackStore.length > 1000) {
    feedbackStore.splice(0, feedbackStore.length - 1000)
  }
  console.log(`[Feedback] New feedback (${feedbackStore.length} total): ${text.trim().slice(0, 60)}`)

  res.json({ success: true, message: '感谢你的反馈！我们会认真阅读每一条建议 💪' })
})
