import { config } from '../config.js'
import type { Request, Response, NextFunction } from 'express'

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(403).json({ success: false, message: '管理员功能未启用（未设置 ADMIN_TOKEN）' })
    return
  }
  const token = (req.query.token as string) || req.headers['x-admin-token'] as string
  if (token !== config.adminToken) {
    res.status(403).json({ success: false, message: 'Token 无效' })
    return
  }
  next()
}
