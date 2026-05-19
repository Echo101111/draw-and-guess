import { Router, type Request, type Response } from 'express'
import { loadCustomWords } from '../data/customWordBank.js'

export const adminRouter: Router = Router()

adminRouter.get('/words', (_req: Request, res: Response) => {
  const entries = loadCustomWords()
  const rows = entries.map(e => `
    <tr>
      <td>${escapeHtml(e.word)}</td>
      <td>${escapeHtml(e.category)}</td>
      <td>${difficultyLabel(e.difficulty)}</td>
      <td>${new Date(e.addedAt).toLocaleString('zh-CN')}</td>
      <td><button class="btn-del" data-word="${escapeHtml(e.word)}">删除</button></td>
    </tr>
  `).join('\n')

  const totalBuiltin = 501

  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>词库管理 — Draw & Guess</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Noto Sans SC', sans-serif;
    background: #FFF8F0;
    color: #4A3728;
    padding: 2rem;
  }
  h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
  .stats { color: #8B7A6A; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(180,140,110,0.1);
  }
  th, td { padding: 0.5rem 0.75rem; text-align: left; font-size: 0.85rem; }
  th { background: #F7EFE6; font-weight: 600; }
  tr:not(:last-child) td { border-bottom: 1px solid #F0E4D8; }
  .btn-del {
    padding: 0.25rem 0.6rem;
    background: #D9756B;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.78rem;
  }
  .btn-del:hover { background: #c0392b; }
  .toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    background: #7EB87A;
    color: #fff;
    border-radius: 999px;
    font-size: 0.85rem;
    display: none;
  }
  .toast.error { background: #D9756B; }
  .empty { color: #B5A392; text-align: center; padding: 2rem; }
</style>
</head>
<body>
<h1>📖 自定义词库管理</h1>
<div class="stats">共 ${entries.length} 个自定义词 · 内置词库 ${totalBuiltin} 个</div>
${entries.length === 0 ? '<div class="empty">暂无自定义词语</div>' : `
<table>
<thead><tr><th>词语</th><th>分类</th><th>难度</th><th>提交时间</th><th>操作</th></tr></thead>
<tbody>${rows}</tbody>
</table>`}
<div id="toast" class="toast"></div>
<script>
document.querySelectorAll('.btn-del').forEach(btn => {
  btn.addEventListener('click', async () => {
    const word = btn.dataset.word
    if (!confirm('确认删除 "' + word + '" ？')) return
    try {
      const res = await fetch('/api/words/' + encodeURIComponent(word), { method: 'DELETE' })
      const data = await res.json()
      showToast(data.message, data.success ? 'success' : 'error')
      if (data.success) setTimeout(() => location.reload(), 1000)
    } catch { showToast('删除失败', 'error') }
  })
})
function showToast(msg, type) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'toast' + (type === 'error' ? ' error' : '')
  t.style.display = 'block'
  setTimeout(() => t.style.display = 'none', 2500)
}
</script>
</body>
</html>`)
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function difficultyLabel(d: string): string {
  return d === 'easy' ? '简单' : d === 'hard' ? '困难' : '中等'
}
