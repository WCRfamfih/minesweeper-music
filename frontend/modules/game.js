import { flashCell } from "./ripple.js";
import { setGrid } from "./state.js";

const API = "http://localhost:3000";
let grid = [];

export async function loadGame() {
  const res = await fetch(API + "/game/state");
  const data = await res.json();
  setGrid(data);    // ⭐ 同步给 sequencer
  grid = data;
  renderGrid();
}

function renderGrid() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const table = document.createElement("div");
  table.className = "grid";

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const data = grid[r][c];
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.setProperty("--b", 1);

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

      cell.addEventListener("click", () => revealCell(r, c));
      cell.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFlag(r, c);
      });

      table.appendChild(cell);
    }
  }

  app.appendChild(table);
}

export async function toggleFlag(r, c) {
  await fetch(API + "/game/cell/flag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row: r, col: c }),
  });
  loadGame();
}

export async function revealCell(r, c) {
  const res = await fetch(API + "/game/cell/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row: r, col: c }),
  });

  const result = await res.json();

  if (result.hitMine) {
    const cells = document.querySelectorAll(".cell");
    const idx = r * 16 + c;

    if (cells[idx]) {
      cells[idx].classList.add("mine-hit");
      cells[idx].textContent = "💥";
    }

    setTimeout(() => {
      alert("💥 游戏结束！你踩到了地雷！");
      restartGame();
    }, 150);

    return;
  }

  if (result.win) {
    setTimeout(() => {
      alert("🎉 恭喜通关！");
      restartGame();
    }, 50);
    return;
  }

  loadGame();
}

export async function restartGame() {
  await fetch(API + "/game/restart", { method: "POST" });
  loadGame();
}
