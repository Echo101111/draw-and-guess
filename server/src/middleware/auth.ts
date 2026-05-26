import { config } from '../config.js'
import type { Request, Response, NextFunction } from 'express'

export function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理员登录 — Draw & Guess</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Noto Sans SC', sans-serif;
    background: linear-gradient(135deg, #FFF8F0 0%, #F7EFE6 100%);
    color: #4A3728;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-box {
    background: #fff;
    padding: 2.5rem 2rem 2rem;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(180,140,110,0.15);
    width: 340px;
    text-align: center;
  }
  .login-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
  h1 { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.3rem; }
  .login-desc { font-size: 0.82rem; color: #8B7A6A; margin-bottom: 1.5rem; }
  .input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 2px solid #E8DDD0;
    border-radius: 8px;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 1rem;
  }
  .input:focus { border-color: #E8856C; }
  .btn {
    width: 100%;
    padding: 0.65rem;
    background: linear-gradient(135deg, #E8856C, #D9756B);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(232,133,108,0.3); }
  .error { color: #D9756B; font-size: 0.82rem; margin-top: 0.75rem; }
</style>
</head>
<body>
  <div class="login-box">
    <div class="login-icon">🔐</div>
    <h1>管理员登录</h1>
    <div class="login-desc">输入管理员密码进入后台</div>
    <form method="post" action="/admin/login">
      <input class="input" type="password" name="password" placeholder="请输入密码" autofocus required>
      <button class="btn" type="submit">登录</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  </div>
</body>
</html>`
}

function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const k = part.slice(0, eqIdx).trim()
    const v = part.slice(eqIdx + 1).trim()
    if (k === name) return decodeURIComponent(v)
  }
  return undefined
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(403).send(loginPage('管理员功能未启用（未设置 ADMIN_TOKEN）'))
    return
  }
  const token = (req.query.token as string) || req.headers['x-admin-token'] as string || getCookie(req, 'admin_token') || ''
  if (token !== config.adminToken) {
    res.status(403).send(loginPage('密码错误，请重试'))
    return
  }
  next()
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
