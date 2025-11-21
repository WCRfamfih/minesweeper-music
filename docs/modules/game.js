// ✅ 前端版 Minesweeper —— 不使用任何后端 API
import { flashCell } from "./ripple.js";
import { setGrid } from "./state.js";
import { createGrid } from "./grid.js";

// 我们在前端维护一个 grid 实例
let game = null;

// 默认参数，16x16，40 雷
const ROWS = 16;
const COLS = 16;
const MINES = 40;

// ======================================================
// 初始化游戏（替代原 loadGame）
// ======================================================
export async function loadGame() {
  if (!game) {
    // 第一次进入游戏，创建前端 grid 逻辑
    game = createGrid(ROWS, COLS, MINES);
  }

  renderGrid();
  setGrid(game.grid); // 同步给 sequencer（保持功能不变）
}

// ======================================================
// 绘制棋盘
// ======================================================
function renderGrid() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const table = document.createElement("div");
  table.className = "grid";

  const grid = game.grid;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const data = grid[r][c];
      const cell = document.createElement("div");
      cell.className = "cell";

      if (data.revealed) {
        cell.classList.add("revealed");
        if (data.isMine) {
          cell.classList.add("mine-hit");
          cell.textContent = "💥";
        } else if (data.number > 0) {
          cell.textContent = data.number;
          cell.classList.add("num-" + data.number);
        }
      }

      if (data.flagged && !data.revealed) {
        cell.classList.add("flagged");
        cell.textContent = "⚑";
      }

      // 左键：翻开
      cell.addEventListener("click", () => revealCell(r, c));

      // 右键：插旗
      cell.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFlag(r, c);
      });

      table.appendChild(cell);
    }
  }

  app.appendChild(table);
}

// ======================================================
// 右键插旗
// ======================================================
export function toggleFlag(r, c) {
  game.toggleFlag(r, c);
  setGrid(game.grid);
  renderGrid();
}

// ======================================================
// 左键翻开
// ======================================================
export function revealCell(r, c) {
  const result = game.revealCell(r, c);

  if (result.hitMine) {
    alert("💥 游戏结束！你踩到了地雷！");
    restartGame();
    return;
  }

  if (game.checkWin()) {
    alert("🎉 恭喜通关！");
    restartGame();
    return;
  }

  setGrid(game.grid);
  renderGrid();
}

// ======================================================
// 重开游戏
// ======================================================
export function restartGame() {
  game = createGrid(ROWS, COLS, MINES);
  setGrid(game.grid);
  renderGrid();
}
