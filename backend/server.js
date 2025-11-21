import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGrid } from './game/grid.js';

// 用于 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

/* ========== 1. 扫雷游戏数据结构 ========== */

let game = createGrid();
let grid = game.grid;

/* ========== 2. API：获取棋盘状态 ========== */
app.get('/game/state', (req, res) => {
  res.json(grid);
});

/* ========== 3. API：插旗（音符） ========== */
app.post('/game/cell/flag', (req, res) => {
  const { row, col } = req.body;

  if (!grid[row] || !grid[row][col]) {
    return res.status(400).json({ error: "Invalid cell" });
  }

  // 翻开的格子不能插旗
  if (grid[row][col].revealed) {
    return res.json({ ok: false });
  }

  game.toggleFlag(row, col);
  return res.json({ ok: true });
});

/* ========== 4. API：翻格（扫雷左键） ========== */
app.post('/game/cell/reveal', (req, res) => {
  const { row, col } = req.body;

  const result = game.revealCell(row, col);

  res.json({
    hitMine: result.hitMine,
    win: game.checkWin()
  });
});

/* ========== 5. API：重置游戏 ========== */
app.post('/game/restart', (req, res) => {
  game = createGrid();
  grid = game.grid;
  res.json({ ok: true });
});

/* ========== 6. 一体化静态前端 ========== */
/*
   现在你的前端（index.html / main.js / style.css）
   全部由后端托管，不再需要 Live Server
*/

const frontendDir = path.join(__dirname, '../frontend');

// 提供静态文件
app.use(express.static(frontendDir));

// 前端入口
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

/* ========== 7. 启动服务器 ========== */
app.listen(3000, () => {
  console.log("🎉 全部启动成功！访问 http://localhost:3000 即可运行游戏");
});
