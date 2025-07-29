document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById('board');
  // ==== 【スマホリサイズ対応】 ====
  function resizeForMobile() {
    // スマホなら盤面幅を画面サイズに合わせる
    if (window.innerWidth < 800) {
      let w = Math.min(window.innerWidth * 0.97, 380);
      canvas.width = w;
      canvas.height = w * (20/12); // ROWS/COLS比率で計算
    } else {
      canvas.width = 240;
      canvas.height = 400;
    }
  }
  resizeForMobile();
  window.addEventListener('resize', () => {
    resizeForMobile();
    draw();
  });

  const context = canvas.getContext('2d');
  const ROWS = 20;
  const COLS = 12;
  const arena = createMatrix(COLS, ROWS);

  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');
  const nextCanvases = document.querySelectorAll('.next');

  const colors = [
    null,
    '#00FFFF',    // I
    '#0000FF',    // J
    '#FFA500',    // L
    '#FFFF00',    // O
    '#00FF00',    // S
    '#e628e6ff',  // T
    '#FF0000'     // Z
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

  function drawMatrix(matrix, offset, ctx = context) {
    // --- スマホ時はブロックサイズ自動計算 ---
    const blockSize = (ctx === context)
      ? Math.floor(canvas.width / COLS)
      : 10;
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
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
            (x + ghostPos.x) * blockSize,
            (y + ghostPos.y) * blockSize,
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
    drawGhost();
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
      case ' ': case 'Spacebar': case 'Space': playerHardDrop(); break;
      case 'z': case 'Z': playerRotate(-1); break;
      case 'x': case 'X': playerRotate(1); break;
      case 'c': case 'C': playerHold(); break;
    }
  });

  document.getElementById("play").addEventListener("click", () => {
    pause = !pause;
    if (!pause) update();
    document.getElementById("play").textContent = pause ? "PLAY" : "PAUSE";
    canvas.focus();
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

  // ==== 【スマホ用：ドラッグ＆ダブルタップ操作追加】 ====
  let dragStartX = 0;
  let dragStartPosX = 0;
  let dragging = false;
  let lastTapTime = 0;
  let tapTimeout = null;

  function isMobile() {
    return /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  }

  if (isMobile()) {
    // ドラッグ開始
    canvas.addEventListener("touchstart", e => {
      if (pause) return;
      if (e.touches.length > 1) return;
      dragStartX = e.touches[0].clientX;
      dragStartPosX = player.pos.x;
      dragging = false;
    });
    // ドラッグ中
    canvas.addEventListener("touchmove", e => {
      if (pause) return;
      if (e.touches.length > 1) return;
      const t = e.touches[0];
      const deltaX = t.clientX - dragStartX;
      if (Math.abs(deltaX) > 8) {
        dragging = true;
        let move = Math.round(deltaX / (canvas.width / COLS));
        let newX = dragStartPosX + move;
        newX = Math.max(0, Math.min(COLS - player.matrix[0].length, newX));
        player.pos.x = newX;
        draw();
      }
      e.preventDefault();
    });
    // 指を離したとき：シングルタップで回転／ダブルタップでハードドロップ
    canvas.addEventListener("touchend", e => {
      if (pause) return;
      if (!dragging) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          // ダブルタップ→ハードドロップ
          playerHardDrop();
          lastTapTime = 0;
          if (tapTimeout) clearTimeout(tapTimeout);
        } else {
          // シングルタップ→回転（0.3秒後にダブルタップじゃなければ実行）
          tapTimeout = setTimeout(() => {
            playerRotate(1);
            draw();
          }, 300);
          lastTapTime = now;
        }
      }
      dragging = false;
    });
  }
});
