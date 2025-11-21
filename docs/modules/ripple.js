/* ============================================
   ripple.js
   方格水波扩散光效
============================================ */

/**
 * 播放标记音符的水波扩散光效
 * @param {number} r - 行
 * @param {number} c - 列
 */
export function flashCell(r, c) {
  const cells = document.querySelectorAll(".cell");

  function getCell(row, col) {
    if (row < 0 || row >= 16 || col < 0 || col >= 16) return null;
    return cells[row * 16 + col];
  }

  const maxDist = Math.ceil(Math.sqrt(16 * 16 + 16 * 16));
  const speed = 22;   // 帧速度
  const sigma = 1.1;  // 波峰宽度

  for (let t = 0; t <= maxDist; t++) {
    setTimeout(() => {
      for (let rr = 0; rr < 16; rr++) {
        for (let cc = 0; cc < 16; cc++) {
          const d = Math.sqrt((rr - r) ** 2 + (cc - c) ** 2);

          // 高斯波峰
          const b = Math.exp(-((d - t) ** 2) / sigma);

          if (b > 0.02) {
            const cell = getCell(rr, cc);
            if (!cell || cell.classList.contains("revealed")) continue;

            const brightness = 1 + b * 0.6;
            cell.style.setProperty("--b", brightness);

            // 自动恢复亮度
            setTimeout(() => {
              cell.style.setProperty("--b", 1);
            }, 200);
          }
        }
      }
    }, t * speed);
  }
}
