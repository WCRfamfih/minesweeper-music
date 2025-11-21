/* ============================================
   state.js
   共享 grid 数据给 sequencer
============================================ */

let grid = [];

export function setGrid(g) {
  grid = g;
}

export function getGrid() {
  return grid;
}
