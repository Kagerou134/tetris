document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById('board');
  canvas.width = 240;
  canvas.height = 400;
  const context = canvas.getContext('2d');
 
  const ROWS = 20;
  const COLS = 12;
  const arena = createMatrix(COLS, ROWS);
 
  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');
  const nextCanvases = document.querySelectorAll('.next');
 
  const colors = [
    null,         // 0: 空
    '#00FFFF',    // 1: I
    '#0000FF',    // 2: J
    '#FFA500',    // 3: L
    '#FFFF00',    // 4: O
    '#00FF00',    // 5: S
    '#800080',    // 6: T
    '#FF0000'     // 7: Z
  ];
 
  const pieces = 'IJLOSTZ';
  function createPiece(type) {
    switch(type) {
      case 'I': return [[1,1,1,1]];
      case 'J': return [[0,0,2],[2,2,2]];
      case 'L': return [[3,0,0],[3,3,3]];
      case 'O': return [[4,4],[4,4]];
      case 'S': return [[0,5,5],[5,5,0]];
      case 'T': return [[0,6,0],[6,6,6]];
      case 'Z': return [[7,7,0],[0,7,7]];
    }
  }
 
  function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
  }
 
  const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
    level: 0,
    hold: null,
    hasHeld: false,
    next: [],
  };
 
  function drawMatrix(matrix, offset, ctx = context) {
    const blockSize = (ctx === context) ? 20 : 10;
 
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          console.log(`Drawing block: value=${value}, color=${colors[value]}, position=(${x + offset.x}, ${y + offset.y})`);
          ctx.fillStyle = colors[value] || '#F0F';
          ctx.fillRect(
            (x + offset.x) * blockSize,
            (y + offset.y) * blockSize,
            blockSize,
            blockSize
          );
          ctx.strokeStyle = '#222';
          ctx.strokeRect(
            (x + offset.x) * blockSize,
            (y + offset.y) * blockSize,
            blockSize,
            blockSize
          );
        }
      });
    });
  }
 
  function drawHold() {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (player.hold) drawMatrix(player.hold, {x: 1, y: 1}, holdCtx);
  }
 
  function drawNext() {
    player.next.forEach((matrix, i) => {
      const ctx = nextCanvases[i].getContext('2d');
      ctx.clearRect(0, 0, 80, 80);
      drawMatrix(matrix, {x: 1, y: 1}, ctx);
    });
  }
 
  function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
      }
    }
    return false;
  }
 
  function merge(arena, player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
      });
    });
  }
 
  function rotate(matrix, dir) {
  // 一時的に新しいmatrix作って入れ替え
  const N = matrix.length;
  const M = matrix[0].length;
  let res = [];
  if (dir > 0) {
    // 右回転
    for (let x = 0; x < M; x++) {
      res[x] = [];
      for (let y = N - 1; y >= 0; y--) {
        res[x][N - 1 - y] = matrix[y][x];
      }
    }
  } else {
    // 左回転
    for (let x = M - 1; x >= 0; x--) {
      res[M - 1 - x] = [];
      for (let y = 0; y < N; y++) {
        res[M - 1 - x][y] = matrix[y][x];
      }
    }
  }
  // 元matrixに反映
  matrix.length = 0;
  res.forEach(row => matrix.push(row));
}
 
  function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) {
        rotate(player.matrix, -dir);
        player.pos.x = pos;
        return;
      }
    }
  }
 
  function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      playerReset();
      sweepLines();
      updateScore();
    }
    dropCounter = 0;
  }
 
  function playerHardDrop() {
    while (!collide(arena, player)) player.pos.y++;
    player.pos.y--;
    merge(arena, player);
    playerReset();
    sweepLines();
    updateScore();
    dropCounter = 0;
  }
 
  function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
  }
 
  function playerReset() {
    player.matrix = player.next.shift();
    while (player.next.length < 4) player.next.push(createPiece(randomPiece()));
    player.pos.y = 0;
    player.pos.x = (COLS / 2 | 0) - (player.matrix[0].length / 2 | 0);
    player.hasHeld = false;
    if (collide(arena, player)) {
      pause = true;
      alert("GAME OVER");
      arena.forEach(row => row.fill(0));
      player.score = 0;
      player.level = 0;
    }
    drawNext();
    drawHold();
    updateScore();
  }
 
  function playerHold() {
    if (player.hasHeld) return;
    const temp = player.hold;
    player.hold = player.matrix;
    if (temp) {
      player.matrix = temp;
    } else {
      player.matrix = player.next.shift();
      player.next.push(createPiece(randomPiece()));
    }
    player.pos.y = 0;
    player.pos.x = (COLS / 2 | 0) - (player.matrix[0].length / 2 | 0);
    player.hasHeld = true;
    drawHold();
    drawNext();
  }
 
  function sweepLines() {
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (arena[y][x] === 0) continue outer;
      }
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      y++;
      player.score += 100;
      player.level = Math.floor(player.score / 1000);
    }
  }
 
  function updateScore() {
    document.getElementById('score').textContent = `SCORE:${String(player.score).padStart(12, '0')}`;
    document.getElementById('level').textContent = `LV:${String(player.level).padStart(3, '0')}`;
  }
 
  function randomPiece() {
    return pieces[Math.floor(Math.random() * pieces.length)];
  }
 
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let pause = true;
 
  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
  }
 
  function update(time = 0) {
    if (pause) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval - player.level * 50) playerDrop();
    draw();
    requestAnimationFrame(update);
  }
 
  document.addEventListener("keydown", e => {
    if (pause) return;
    switch (e.key) {
      case 'ArrowLeft': playerMove(-1); break;
      case 'ArrowRight': playerMove(1); break;
      case 'ArrowDown': playerDrop(); break;
      case 'Enter': playerHardDrop(); break;
      case 'z': case 'Z': playerRotate(-1); break;
      case 'x': case 'X': playerRotate(1); break;
      case 'c': case 'C': playerHold(); break;
    }
  });
 
  document.getElementById("play").addEventListener("click", () => {
    pause = !pause;
    if (!pause) update();
    document.getElementById("play").textContent = pause ? "PLAY" : "PAUSE";
  });
 
  document.getElementById("reset").addEventListener("click", () => {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.level = 0;
    player.next = [];
    for (let i = 0; i < 4; i++) player.next.push(createPiece(randomPiece()));
    playerReset();
    pause = false;
    updateScore();
    update();
    document.getElementById("play").textContent = "PAUSE";
  });
 
  document.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const event = new KeyboardEvent('keydown', { key });
      document.dispatchEvent(event);
    });
  });
 
  canvas.tabIndex = 1;
  canvas.style.outline = "none";
  canvas.focus();
 
  for (let i = 0; i < 4; i++) player.next.push(createPiece(randomPiece()));
  playerReset();
});
