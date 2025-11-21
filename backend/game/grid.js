// grid.js - Minesweeper logic with first-click safety

export function createGrid(rows = 16, cols = 16, mines = 40) {
  let firstClick = true; // avoid losing on the first click

  // =============================
  // Empty grid factory
  // =============================
  function generateEmptyGrid() {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          flagged: false,
          revealed: false,
          isMine: false,
          number: 0,
        };
      }
    }
    return grid;
  }

  // =============================
  // Place mines (skip the first click and its neighbors)
  // =============================
  function placeMines(grid, avoidR, avoidC) {
    const avoidSet = new Set();

    // classic safety: avoid the first click cell and its 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = avoidR + dr;
        const cc = avoidC + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
          avoidSet.add(`${rr},${cc}`);
        }
      }
    }

    let count = 0;
    while (count < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      if (avoidSet.has(`${r},${c}`)) continue;
      if (!grid[r][c].isMine) {
        grid[r][c].isMine = true;
        count++;
      }
    }
  }

  // =============================
  // Number calculation
  // =============================
  const dirs = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  function computeNumbers(grid) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].isMine) continue;

        let num = 0;
        for (const [dr, dc] of dirs) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc].isMine) {
            num++;
          }
        }
        grid[r][c].number = num;
      }
    }
  }

  // =============================
  // Flood reveal (BFS)
  // =============================
  function floodReveal(grid, row, col) {
    const queue = [[row, col]];
    const visited = new Set();

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      grid[r][c].revealed = true;
      grid[r][c].flagged = false;

      if (grid[r][c].number !== 0) continue;

      for (const [dr, dc] of dirs) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
          if (!grid[rr][cc].revealed && !grid[rr][cc].flagged) {
            queue.push([rr, cc]);
          }
        }
      }
    }
  }

  // =============================
  // Initial grid (mines are placed on the first reveal)
  // =============================
  const grid = generateEmptyGrid();

  // =============================
  // Reveal with first-click protection
  // =============================
  function revealCell(row, col) {
    let cell = grid[row][col];

    if (cell.revealed || cell.flagged) return { hitMine: false };

    // First click: safely place mines and numbers on the existing grid
    if (firstClick) {
      firstClick = false;
      placeMines(grid, row, col);
      computeNumbers(grid);
      cell = grid[row][col];
    }

    // Reveal logic
    cell.revealed = true;

    if (cell.isMine) {
      return { hitMine: true };
    }

    if (cell.number === 0) {
      floodReveal(grid, row, col);
    }

    return { hitMine: false };
  }

  // =============================
  // Flag toggle
  // =============================
  function toggleFlag(row, col) {
    const cell = grid[row][col];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
  }

  // =============================
  // Win check
  // =============================
  function checkWin() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell.isMine && !cell.revealed) {
          return false;
        }
      }
    }
    return true;
  }

  return {
    grid,
    revealCell,
    toggleFlag,
    checkWin,
  };
}
