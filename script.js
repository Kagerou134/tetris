document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById('board');
  // === ★ここに移動するだけ！ ===
  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');
  const nextCanvases = document.querySelectorAll('.next');

  // ============ スマホ対応：盤面リサイズ ============
  function resizeForMobile() {
    if (window.innerWidth < 800) {
     let w = Math.floor(Math.min(window.innerWidth * 0.7, 260)); // 画面幅の70% or 最大260px
      // 必ず12の倍数（ブロック幅が整数）に調整
      w -= w % 12;
      canvas.width = w;
      canvas.height = w * (20/12);
      // HOLD/NEXTも拡大
      holdCanvas.width = holdCanvas.height = Math.floor(w / 3.2);
      nextCanvases.forEach(cnv => {
        cnv.width = cnv.height = Math.floor(w / 3.2);
      });
    } else {
      canvas.width = 240;
      canvas.height = 400;
      holdCanvas.width = holdCanvas.height = 80;
      nextCanvases.forEach(cnv => {
        cnv.width = cnv.height = 80;
      });
    }
  }
  // 盤面リサイズ時に再描画も
  function smartResizeAndDraw() {
    resizeForMobile();
    draw();
  }
  // 初回・リサイズ時
  resizeForMobile();
  window.addEventListener('resize', smartResizeAndDraw);

  // ============ ゲームロジック ============

  const context = canvas.getContext('2d');
  const ROWS = 20;
  const COLS = 12;
  const arena = createMatrix(COLS, ROWS);

  const colors = [
    null, '#00FFFF', '#0000FF', '#FFA500', '#FFFF00', '#00FF00', '#e628e6ff', '#FF0000'
  ];

  const pieces = 'IJLOSTZ';
  let bag = [];
  let combo = 0;
  let softDropDistance = 0;

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
  function shuffleBag() {
    const types = pieces.split('');
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types;
  }
  function getNextPiece() {
    if (bag.length === 0) bag = shuffleBag();
    return createPiece(bag.pop());
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

  // --- サイズ自動対応（HOLD/NEXTもblockSize可変）---
  function drawMatrix(matrix, offset, ctx = context, customBlockSize = null) {
    // 盤面は幅÷12、HOLD/NEXTはcanvas幅÷4
    const blockSize = customBlockSize ??
      ((ctx === context) ? Math.floor(canvas.width / COLS) : Math.floor(ctx.canvas.width / 4));
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = colors[value] || '#F0F';
          ctx.fillRect(
            Math.round((x + offset.x) * blockSize),
            Math.round((y + offset.y) * blockSize),
            blockSize,
            blockSize
          );
          ctx.strokeStyle = '#222';
          ctx.strokeRect(
            Math.round((x + offset.x) * blockSize),
            Math.round((y + offset.y) * blockSize),
            blockSize,
            blockSize
          );
        }
      });
    });
  }

  function getGhostY() {
    let y = player.pos.y;
    while (true) {
      y++;
      if (collide(arena, {matrix: player.matrix, pos: {x: player.pos.x, y: y}})) {
        return y - 1;
      }
      if (y > arena.length) return null;
    }
  }
  function drawGhost() {
    const ghostY = getGhostY();
    if (ghostY === null) return;
    const ghostPos = {x: player.pos.x, y: ghostY};
    const blockSize = Math.floor(canvas.width / COLS);
    context.save();
    context.globalAlpha = 0.5;
    const ghostColor = "#B0B0B0";
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          context.fillStyle = ghostColor;
          context.fillRect(
            Math.round((x + ghostPos.x) * blockSize),
            Math.round((y + ghostPos.y) * blockSize),
            blockSize,
            blockSize
          );
        }
      });
    });
    context.restore();
  }
  function drawHold() {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (player.hold) drawMatrix(player.hold, {x: 1, y: 1}, holdCtx);
  }
  function drawNext() {
    player.next.forEach((matrix, i) => {
      const ctx = nextCanvases[i].getContext('2d');
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
    const N = matrix.length;
    const M = matrix[0].length;
    let res = [];
    if (dir > 0) {
      for (let x = 0; x < M; x++) {
        res[x] = [];
        for (let y = N - 1; y >= 0; y--) {
          res[x][N - 1 - y] = matrix[y][x];
        }
      }
    } else {
      for (let x = M - 1; x >= 0; x--) {
        res[M - 1 - x] = [];
        for (let y = 0; y < N; y++) {
          res[M - 1 - x][y] = matrix[y][x];
        }
      }
    }
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
  function sweepLines() {
    let lines = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (arena[y][x] === 0) continue outer;
      }
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      y++;
      lines++;
    }
    const lineScores = [0, 100, 300, 500, 800];
    if (lines > 0) {
      player.score += lineScores[lines] || (lines * 200);
      combo++;
      if (combo > 1) player.score += combo * 50;
    } else {
      combo = 0;
    }
    if (arena.every(row => row.every(cell => cell === 0)) && lines > 0) {
      player.score += 4000;
    }
    player.level = Math.floor(player.score / 1000);
  }
  function playerDrop() {
    player.pos.y++;
    softDropDistance++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      sweepLines();
      player.score += softDropDistance;
      softDropDistance = 0;
      updateScore();
      playerReset();
    }
    dropCounter = 0;
  }
  function playerHardDrop() {
    let drop = 0;
    while (!collide(arena, player)) {
      player.pos.y++;
      drop++;
    }
    player.pos.y--;
    merge(arena, player);
    draw();
    player.score += drop * 2;
    sweepLines();
    updateScore();
    playerReset();
    dropCounter = 0;
  }
  function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
  }
  function playerReset() {
    player.matrix = player.next.shift();
    while (player.next.length < 4) player.next.push(getNextPiece());
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
    draw(); // 確実に盤面更新
  }
  function playerHold() {
    if (player.hasHeld) return;
    const temp = player.hold;
    player.hold = player.matrix;
    if (temp) {
      player.matrix = temp;
    } else {
      player.matrix = player.next.shift();
      player.next.push(getNextPiece());
    }
    player.pos.y = 0;
    player.pos.x = (COLS / 2 | 0) - (player.matrix[0].length / 2 | 0);
    player.hasHeld = true;
    drawHold();
    drawNext();
    draw();
  }
  function updateScore() {
    document.getElementById('score').textContent = `SCORE:${String(player.score).padStart(12, '0')}`;
    document.getElementById('level').textContent = `LV:${String(player.level).padStart(3, '0')}`;
  }

  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let pause = true;

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    if (player.matrix) {
      drawGhost();
      drawMatrix(player.matrix, player.pos);
    }
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
      case 'ArrowLeft': playerMove(-1); draw(); break;
      case 'ArrowRight': playerMove(1); draw(); break;
      case 'ArrowDown': playerDrop(); draw(); break;
      case ' ': case 'Spacebar': case 'Space': playerHardDrop(); break;
      case 'z': case 'Z': playerRotate(-1); draw(); break;
      case 'x': case 'X': playerRotate(1); draw(); break;
      case 'c': case 'C': playerHold(); break;
    }
  });

  document.getElementById("play").addEventListener("click", () => {
    pause = !pause;
    if (!pause) update();
    document.getElementById("play").textContent = pause ? "PLAY" : "PAUSE";
    canvas.focus();
    draw();
  });

  document.getElementById("reset").addEventListener("click", () => {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.level = 0;
    player.next = [];
    for (let i = 0; i < 4; i++) player.next.push(getNextPiece());
    playerReset();
    pause = false;
    updateScore();
    draw();
    update();
    document.getElementById("play").textContent = "PAUSE";
    canvas.focus();
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

  for (let i = 0; i < 4; i++) player.next.push(getNextPiece());
  playerReset();

  // ==== スマホ用：ドラッグ&タップ&ホールドUI対応 ====
  let dragStartX = 0;
  let dragStartPosX = 0;
  let dragging = false;
  let lastTapTime = 0;
  let tapTimeout = null;

  function isMobile() {
    return /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  }

 // ==== スマホ用操作を公式準拠に上書き！ ====
if (isMobile()) {
  let startX = 0, startY = 0, startTime = 0;
  let lastMoveX = 0;
  let moved = false;

  canvas.addEventListener("touchstart", e => {
    if (pause) return;
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    startX = lastMoveX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    moved = false;
  });

  canvas.addEventListener("touchmove", e => {
    if (pause) return;
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    let dx = t.clientX - lastMoveX;
    let totalDx = t.clientX - startX;
    let dy = t.clientY - startY;

    // 横移動（1マス単位で追従。端までしっかり。）
    if (Math.abs(totalDx) > 24 && Math.abs(totalDx) > Math.abs(dy)) {
  let move = Math.round(totalDx / (canvas.width / COLS));
      let newX = player.pos.x + move;
      newX = Math.max(0, Math.min(COLS - player.matrix[0].length, newX));
      if (player.pos.x !== newX) {
        player.pos.x = newX;
        draw();
        moved = true;
        lastMoveX = t.clientX;
      }
    }
    // 下方向スライド（20px以上でソフトドロップ）
    if (dy > 20 && Math.abs(dy) > Math.abs(totalDx) && !moved) {
      playerDrop();
      draw();
      moved = true;
    }
    e.preventDefault();
  });

  canvas.addEventListener("touchend", e => {
    if (pause) return;
    const endTime = Date.now();
    const t = e.changedTouches[0];
    let dx = t.clientX - startX;
    let dy = t.clientY - startY;
    let absDx = Math.abs(dx), absDy = Math.abs(dy);

    // --- ハードドロップ判定 ---
    if (dy > 40 && absDy > absDx && (endTime - startTime) < 200) {
      playerHardDrop();
      draw();
      return;
    }

    // --- 上にフリックでホールド ---
    if (dy < -40 && absDy > absDx && (endTime - startTime) < 200) {
      playerHold();
      draw();
      return;
    }

    // --- タップ(ほぼ動かさない)で回転 ---
    if (absDx < 10 && absDy < 10 && (endTime - startTime) < 200) {
      playerRotate(1);
      draw();
      return;
    }
  });
}
}); 
