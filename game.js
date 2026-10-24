(() => {
  "use strict";

  const COLS = 20;
  const ROWS = 30;
  const CELL = 24;
  const DIRECTIONS = {
    up: { x: 0, y: -1, angle: 0 },
    right: { x: 1, y: 0, angle: Math.PI / 2 },
    down: { x: 0, y: 1, angle: Math.PI },
    left: { x: -1, y: 0, angle: -Math.PI / 2 },
  };

  const canvas = document.querySelector("#game-canvas");
  const context = canvas.getContext("2d");
  const overlay = document.querySelector("#game-overlay");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlaySummary = document.querySelector("#overlay-summary");
  const overlayCode = document.querySelector("#overlay-code");

  const hud = {
    score: document.querySelector("#score-value"),
    playerLife: document.querySelector("#player-life"),
    baseHealth: document.querySelector("#base-health"),
    wave: document.querySelector("#wave-value"),
    enemies: document.querySelector("#enemy-count"),
    shield: document.querySelector("#shield-count"),
    laser: document.querySelector("#laser-count"),
    status: document.querySelector("#status-text"),
    statusDot: document.querySelector("#status-dot"),
  };

  let state;
  let lastFrame = performance.now();
  let audioContext = null;
  let muted = false;

  function obstacleKey(x, y) {
    return `${x},${y}`;
  }

  function createObstacles() {
    const steel = [
      [4, 5], [5, 5], [14, 5], [15, 5],
      [7, 8], [12, 8], [9, 11], [10, 11],
      [3, 15], [4, 15], [15, 15], [16, 15],
      [8, 19], [11, 19], [6, 23], [13, 23],
      [8, 26], [11, 26],
    ];
    const crates = [
      [7, 6], [8, 6], [11, 6], [12, 6],
      [5, 9], [6, 9], [13, 9], [14, 9],
      [6, 12], [7, 12], [12, 12], [13, 12],
      [8, 14], [11, 14], [8, 16], [11, 16],
      [5, 18], [6, 18], [13, 18], [14, 18],
      [9, 21], [10, 21], [4, 23], [15, 23],
      [7, 25], [12, 25], [9, 28], [11, 28],
    ];
    const dropCycle = ["shield", null, "mine", "laser", null, "shield", "mine"];
    const map = new Map();

    steel.forEach(([x, y]) => map.set(obstacleKey(x, y), { x, y, type: "steel" }));
    crates.forEach(([x, y], index) => {
      map.set(obstacleKey(x, y), {
        x,
        y,
        type: "crate",
        drop: dropCycle[index % dropCycle.length],
      });
    });
    return map;
  }

  function resetGame() {
    state = {
      running: true,
      elapsed: 0,
      score: 0,
      kills: 0,
      wave: 1,
      spawnTimer: 350,
      spawnInterval: 2200,
      maxEnemies: 4,
      player: {
        x: 9,
        y: 27,
        dir: "up",
        hp: 3,
        shield: 0,
        laser: 0,
        shotReadyAt: 0,
        flashUntil: 0,
      },
      base: { x: 10, y: 29, hp: 3, flashUntil: 0 },
      spawn: { x: 1, y: 1 },
      enemies: [],
      bullets: [],
      items: [],
      obstacles: createObstacles(),
      effects: [],
      nextEnemyId: 1,
      status: "防线稳定",
      statusUntil: 0,
    };
    overlay.hidden = true;
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function setStatus(message, duration = 1400) {
    state.status = message;
    state.statusUntil = state.elapsed + duration;
  }

  function updateHud() {
    hud.score.textContent = String(state.score).padStart(6, "0");
    hud.playerLife.textContent = state.player.hp;
    hud.baseHealth.textContent = state.base.hp;
    hud.wave.textContent = state.wave;
    hud.enemies.textContent = state.enemies.length;
    hud.shield.textContent = state.player.shield;
    hud.laser.textContent = state.player.laser;
    hud.status.textContent = state.status;

    const danger = state.base.hp === 1 || state.player.hp === 1;
    hud.status.style.color = danger ? "var(--red)" : "var(--green)";
    hud.statusDot.style.background = danger ? "var(--red)" : "var(--green)";
  }

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  function obstacleAt(x, y) {
    return state.obstacles.get(obstacleKey(x, y));
  }

  function enemyAt(x, y, exceptId = null) {
    return state.enemies.find((enemy) => enemy.id !== exceptId && enemy.x === x && enemy.y === y);
  }

  function isBlocked(x, y, movingEnemyId = null) {
    if (!inBounds(x, y) || obstacleAt(x, y)) return true;
    if (state.base.x === x && state.base.y === y) return true;
    if (state.player.x === x && state.player.y === y) return true;
    return Boolean(enemyAt(x, y, movingEnemyId));
  }

  function movePlayer(direction) {
    if (!state.running) return;
    const vector = DIRECTIONS[direction];
    state.player.dir = direction;
    const nextX = state.player.x + vector.x;
    const nextY = state.player.y + vector.y;

    if (!isBlocked(nextX, nextY)) {
      state.player.x = nextX;
      state.player.y = nextY;
      collectItem(nextX, nextY, "player");
      playTone(112, 0.035, "square", 0.025);
    }
  }

  function attackPlayer() {
    if (!state.running || state.elapsed < state.player.shotReadyAt) return;
    state.player.shotReadyAt = state.elapsed + 220;

    if (state.player.laser > 0) {
      state.player.laser -= 1;
      fireLaser();
      updateHud();
      return;
    }

    spawnBullet(state.player, "player");
    playTone(520, 0.06, "square", 0.07);
  }

  function spawnBullet(source, owner) {
    const vector = DIRECTIONS[source.dir];
    const x = source.x + vector.x;
    const y = source.y + vector.y;
    if (!inBounds(x, y)) return;

    state.bullets.push({
      x,
      y,
      dir: source.dir,
      owner,
      moveTimer: 52,
    });
  }

  function fireLaser() {
    const player = state.player;
    const vector = DIRECTIONS[player.dir];
    const hitEnemies = state.enemies.filter((enemy) => {
      if (vector.x !== 0) {
        return enemy.y === player.y && Math.sign(enemy.x - player.x) === vector.x;
      }
      return enemy.x === player.x && Math.sign(enemy.y - player.y) === vector.y;
    });

    hitEnemies.forEach((enemy) => destroyEnemy(enemy, true));
    state.effects.push({
      type: "laser",
      x: player.x,
      y: player.y,
      dir: player.dir,
      expires: state.elapsed + 220,
    });
    setStatus(hitEnemies.length ? `镭射贯穿 ${hitEnemies.length} 辆敌军` : "镭射清空射线");
    playTone(880, 0.16, "sawtooth", 0.08);
  }

  function updateBullets(delta) {
    for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.bullets[index];
      bullet.moveTimer -= delta;
      if (bullet.moveTimer > 0) continue;
      bullet.moveTimer += 52;

      if (resolveBulletImpact(bullet)) {
        state.bullets.splice(index, 1);
        continue;
      }

      const vector = DIRECTIONS[bullet.dir];
      bullet.x += vector.x;
      bullet.y += vector.y;
      if (!inBounds(bullet.x, bullet.y) || resolveBulletImpact(bullet)) {
        state.bullets.splice(index, 1);
      }
    }
  }

  function resolveBulletImpact(bullet) {
    if (!inBounds(bullet.x, bullet.y)) return true;
    const obstacle = obstacleAt(bullet.x, bullet.y);
    if (obstacle) {
      if (obstacle.type === "crate" && bullet.owner === "player") {
        destroyCrate(obstacle);
      }
      sparkAt(bullet.x, bullet.y);
      return true;
    }

    if (bullet.owner === "player") {
      const enemy = enemyAt(bullet.x, bullet.y);
      if (enemy) {
        destroyEnemy(enemy, false);
        return true;
      }
    } else {
      if (state.player.x === bullet.x && state.player.y === bullet.y) {
        hitPlayer();
        return true;
      }
      if (state.base.x === bullet.x && state.base.y === bullet.y) {
        hitBase();
        return true;
      }
    }
    return false;
  }

  function destroyCrate(crate) {
    state.obstacles.delete(obstacleKey(crate.x, crate.y));
    state.score += 20;
    explosionAt(crate.x, crate.y, "#e2a65a");
    if (crate.drop) {
      state.items.push({ x: crate.x, y: crate.y, type: crate.drop, pulse: 0 });
      setStatus(crate.drop === "mine" ? "障碍内发现地雷" : "障碍内发现补给");
    }
    updateHud();
  }

  function destroyEnemy(enemy, laser) {
    const index = state.enemies.findIndex((item) => item.id === enemy.id);
    if (index === -1) return;
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.score += laser ? 160 : 100;
    explosionAt(enemy.x, enemy.y, "#ef6b4f");
    playTone(180, 0.12, "sawtooth", 0.07);

    const nextWave = Math.floor(state.kills / 6) + 1;
    if (nextWave > state.wave) {
      state.wave = nextWave;
      state.maxEnemies = Math.min(8, 3 + state.wave);
      state.spawnInterval = Math.max(900, 2200 - (state.wave - 1) * 180);
      setStatus(`第 ${state.wave} 波敌军抵达`, 2200);
    }
    updateHud();
  }

  function hitPlayer() {
    if (!state.running) return;
    if (state.player.shield > 0) {
      state.player.shield -= 1;
      state.player.flashUntil = state.elapsed + 220;
      setStatus("保护罩吸收攻击");
      playTone(720, 0.09, "sine", 0.06);
    } else {
      state.player.hp -= 1;
      state.player.flashUntil = state.elapsed + 300;
      setStatus("我方战车受损");
      playTone(110, 0.16, "square", 0.08);
      if (state.player.hp <= 0) endGame("UNIT LOST", "战车损毁", "防守单位已失去战斗力");
    }
    updateHud();
  }

  function hitBase() {
    if (!state.running) return;
    state.base.hp -= 1;
    state.base.flashUntil = state.elapsed + 350;
    setStatus("基地遭到攻击", 2000);
    playTone(82, 0.22, "sawtooth", 0.1);
    if (state.base.hp <= 0) endGame("BASE LOST", "防线失守", "基地已被敌军摧毁");
    updateHud();
  }

  function collectItem(x, y, collector) {
    const index = state.items.findIndex((item) => item.x === x && item.y === y);
    if (index === -1) return;
    const item = state.items[index];
    state.items.splice(index, 1);

    if (item.type === "shield" && collector === "player") {
      state.player.shield = 3;
      setStatus("保护罩已充能：3");
      playTone(660, 0.14, "sine", 0.07);
    } else if (item.type === "laser" && collector === "player") {
      state.player.laser = Math.min(3, state.player.laser + 1);
      setStatus("镭射炮已装填");
      playTone(940, 0.13, "triangle", 0.07);
    } else if (item.type === "mine") {
      explosionAt(x, y, "#ff9f43");
      if (collector === "player") hitPlayer();
      playTone(70, 0.2, "square", 0.1);
    }
    updateHud();
  }

  function updateEnemies(delta) {
    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0 && state.enemies.length < state.maxEnemies) {
      spawnEnemy();
      state.spawnTimer = state.spawnInterval;
    }

    [...state.enemies].forEach((enemy) => {
      enemy.stepTimer -= delta;
      enemy.shotTimer -= delta;
      if (enemy.stepTimer > 0) return;
      enemy.stepTimer = Math.max(250, 650 - state.wave * 25) + Math.random() * 170;

      const target = chooseVisibleTarget(enemy);
      if (target && enemy.shotTimer <= 0) {
        enemy.dir = target.direction;
        spawnBullet(enemy, "enemy");
        enemy.shotTimer = Math.max(620, 1260 - state.wave * 45);
        return;
      }

      const direction = chooseEnemyMoveDirection(enemy);
      if (!direction) return;
      enemy.dir = direction;
      const vector = DIRECTIONS[direction];
      const nextX = enemy.x + vector.x;
      const nextY = enemy.y + vector.y;

      if (state.base.x === nextX && state.base.y === nextY) {
        if (enemy.shotTimer <= 0) {
          spawnBullet(enemy, "enemy");
          enemy.shotTimer = 850;
        }
        return;
      }

      if (!isBlocked(nextX, nextY, enemy.id)) {
        enemy.x = nextX;
        enemy.y = nextY;
        enemy.straightSteps = direction === enemy.lastMove ? enemy.straightSteps + 1 : 1;
        enemy.lastMove = direction;
        const mineIndex = state.items.findIndex(
          (item) => item.x === nextX && item.y === nextY && item.type === "mine",
        );
        if (mineIndex >= 0) {
          state.items.splice(mineIndex, 1);
          destroyEnemy(enemy, false);
        }
      } else if (obstacleAt(nextX, nextY)?.type === "crate" && enemy.shotTimer <= 0) {
        spawnBullet(enemy, "enemy");
        enemy.shotTimer = 900;
      }
    });
  }

  function spawnEnemy() {
    const { x, y } = state.spawn;
    if (isBlocked(x, y)) return;
    state.enemies.push({
      id: state.nextEnemyId++,
      x,
      y,
      dir: "down",
      stepTimer: 250,
      shotTimer: 600 + Math.random() * 500,
      lastMove: "down",
      straightSteps: 0,
    });
    setStatus("敌军从西北入口出现", 1000);
    updateHud();
  }

  function clearLineBetween(ax, ay, bx, by) {
    if (ax !== bx && ay !== by) return false;
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax + dx;
    let y = ay + dy;
    while (x !== bx || y !== by) {
      if (obstacleAt(x, y)) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  function directionBetween(ax, ay, bx, by) {
    if (ax === bx) return by < ay ? "up" : "down";
    return bx < ax ? "left" : "right";
  }

  function chooseVisibleTarget(enemy) {
    const targets = [state.player, state.base];
    for (const target of targets) {
      if ((enemy.x === target.x || enemy.y === target.y) && clearLineBetween(enemy.x, enemy.y, target.x, target.y)) {
        return { target, direction: directionBetween(enemy.x, enemy.y, target.x, target.y) };
      }
    }
    return null;
  }

  function nextDirectionTowardBase(enemy) {
    const goals = new Set();
    Object.values(DIRECTIONS).forEach((vector) => {
      const x = state.base.x + vector.x;
      const y = state.base.y + vector.y;
      if (inBounds(x, y) && !obstacleAt(x, y)) goals.add(obstacleKey(x, y));
    });

    const queue = [{ x: enemy.x, y: enemy.y, first: null }];
    const visited = new Set([obstacleKey(enemy.x, enemy.y)]);
    const preferred = ["down", "right", "left", "up"];

    while (queue.length) {
      const current = queue.shift();
      if (goals.has(obstacleKey(current.x, current.y)) && current.first) return current.first;

      for (const direction of preferred) {
        const vector = DIRECTIONS[direction];
        const x = current.x + vector.x;
        const y = current.y + vector.y;
        const key = obstacleKey(x, y);
        if (visited.has(key) || !inBounds(x, y) || obstacleAt(x, y)) continue;
        if (state.base.x === x && state.base.y === y) continue;
        if (enemyAt(x, y, enemy.id) || (state.player.x === x && state.player.y === y)) continue;
        visited.add(key);
        queue.push({ x, y, first: current.first || direction });
      }
    }

    return preferred.find((direction) => {
      const vector = DIRECTIONS[direction];
      return !isBlocked(enemy.x + vector.x, enemy.y + vector.y, enemy.id);
    }) || null;
  }

  function chooseEnemyMoveDirection(enemy) {
    const routeDirection = nextDirectionTowardBase(enemy);
    const allDirections = ["up", "right", "down", "left"];
    const legalDirections = allDirections.filter((direction) => {
      const vector = DIRECTIONS[direction];
      return !isBlocked(enemy.x + vector.x, enemy.y + vector.y, enemy.id);
    });

    if (!legalDirections.length) return null;
    if (legalDirections.length === 1) return legalDirections[0];

    const sideDirections = legalDirections.filter((direction) => direction !== enemy.lastMove);
    const shouldTurn = enemy.straightSteps >= 2 && sideDirections.length > 0 && Math.random() < 0.72;
    if (shouldTurn) {
      const routeSide = sideDirections.filter((direction) => {
        const vector = DIRECTIONS[direction];
        const nextX = enemy.x + vector.x;
        const nextY = enemy.y + vector.y;
        const currentDistance = Math.abs(state.base.x - enemy.x) + Math.abs(state.base.y - enemy.y);
        const nextDistance = Math.abs(state.base.x - nextX) + Math.abs(state.base.y - nextY);
        return nextDistance <= currentDistance + 1;
      });
      const choices = routeSide.length ? routeSide : sideDirections;
      return choices[Math.floor(Math.random() * choices.length)];
    }

    if (routeDirection && legalDirections.includes(routeDirection)) return routeDirection;

    const scored = legalDirections.map((direction) => {
      const vector = DIRECTIONS[direction];
      const nextX = enemy.x + vector.x;
      const nextY = enemy.y + vector.y;
      const distance = Math.abs(state.base.x - nextX) + Math.abs(state.base.y - nextY);
      const score = -distance + (direction === enemy.lastMove ? 1 : 0);
      return { direction, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].direction;
  }

  function updateEffects() {
    state.effects = state.effects.filter((effect) => effect.expires > state.elapsed);
    if (state.statusUntil && state.elapsed > state.statusUntil && state.running) {
      state.status = state.base.hp === 1 || state.player.hp === 1 ? "防线告急" : "防线稳定";
      state.statusUntil = 0;
      updateHud();
    }
  }

  function endGame(code, title, summary) {
    state.running = false;
    overlayCode.textContent = code;
    overlayTitle.textContent = title;
    overlaySummary.textContent = `${summary} · 得分 ${state.score}`;
    overlay.hidden = false;
    updateHud();
  }

  function explosionAt(x, y, color) {
    state.effects.push({ type: "explosion", x, y, color, expires: state.elapsed + 320 });
  }

  function sparkAt(x, y) {
    state.effects.push({ type: "spark", x, y, expires: state.elapsed + 100 });
  }

  function update(delta) {
    state.elapsed += delta;
    if (state.running) {
      updateBullets(delta);
      updateEnemies(delta);
      state.items.forEach((item) => { item.pulse += delta; });
    }
    updateEffects();
  }

  function draw() {
    drawArena();
    state.obstacles.forEach(drawObstacle);
    state.items.forEach(drawItem);
    drawBase(state.base);
    state.enemies.forEach((enemy) => drawTank(enemy, false));
    drawTank(state.player, true);
    state.bullets.forEach(drawBullet);
    state.effects.forEach(drawEffect);
    drawSpawnMarker();
  }

  function drawArena() {
    context.fillStyle = "#162018";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.025)";
        context.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    context.strokeStyle = "rgba(136, 155, 136, 0.12)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 1; x < COLS; x += 1) {
      context.moveTo(x * CELL + 0.5, 0);
      context.lineTo(x * CELL + 0.5, canvas.height);
    }
    for (let y = 1; y < ROWS; y += 1) {
      context.moveTo(0, y * CELL + 0.5);
      context.lineTo(canvas.width, y * CELL + 0.5);
    }
    context.stroke();

    context.strokeStyle = "rgba(243, 200, 73, 0.38)";
    context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }

  function cellCenter(x, y) {
    return { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 };
  }

  function drawObstacle(obstacle) {
    const px = obstacle.x * CELL;
    const py = obstacle.y * CELL;
    if (obstacle.type === "steel") {
      context.fillStyle = "#59645d";
      context.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      context.fillStyle = "#758177";
      context.fillRect(px + 4, py + 4, CELL - 8, 3);
      context.fillStyle = "#313933";
      context.fillRect(px + 5, py + 10, CELL - 10, 5);
      context.fillStyle = "#aab2aa";
      [[5, 5], [CELL - 6, 5], [5, CELL - 6], [CELL - 6, CELL - 6]].forEach(([x, y]) => {
        context.fillRect(px + x - 1, py + y - 1, 2, 2);
      });
    } else {
      context.fillStyle = "#8e5b32";
      context.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      context.fillStyle = "#bf8250";
      context.fillRect(px + 4, py + 4, CELL - 8, 3);
      context.strokeStyle = "#5d351f";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(px + 4, py + 4);
      context.lineTo(px + CELL - 4, py + CELL - 4);
      context.moveTo(px + CELL - 4, py + 4);
      context.lineTo(px + 4, py + CELL - 4);
      context.stroke();
    }
  }

  function drawTank(tank, player) {
    const center = cellCenter(tank.x, tank.y);
    const angle = DIRECTIONS[tank.dir].angle;
    const flashing = player && tank.flashUntil > state.elapsed;
    context.save();
    context.translate(center.x, center.y);
    context.rotate(angle);
    context.globalAlpha = flashing && Math.floor(state.elapsed / 55) % 2 === 0 ? 0.35 : 1;

    context.fillStyle = player ? "#e8c64f" : "#d95a43";
    context.fillRect(-8, -8, 16, 17);
    context.fillStyle = player ? "#fff19b" : "#ff927d";
    context.fillRect(-5, -6, 10, 8);
    context.fillStyle = "#262d27";
    context.fillRect(-11, -9, 4, 19);
    context.fillRect(7, -9, 4, 19);
    context.fillStyle = "#111612";
    for (let y = -7; y <= 7; y += 5) {
      context.fillRect(-10, y, 2, 3);
      context.fillRect(8, y, 2, 3);
    }
    context.fillStyle = player ? "#79631d" : "#74291e";
    context.fillRect(-2, -13, 4, 12);
    context.fillStyle = "#dfe9dc";
    context.fillRect(-1, -14, 2, 3);

    context.restore();

    if (player && tank.shield > 0) {
      context.strokeStyle = `rgba(85, 217, 220, ${0.65 + Math.sin(state.elapsed / 110) * 0.2})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(center.x, center.y, 14, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawBase(base) {
    const px = base.x * CELL;
    const py = base.y * CELL;
    const flashing = base.flashUntil > state.elapsed;
    context.save();
    context.globalAlpha = flashing && Math.floor(state.elapsed / 60) % 2 === 0 ? 0.35 : 1;
    context.fillStyle = "#c79e35";
    context.fillRect(px + 2, py + 7, CELL - 4, CELL - 9);
    context.fillStyle = "#e7c35c";
    context.beginPath();
    context.moveTo(px + 2, py + 8);
    context.lineTo(px + CELL / 2, py + 1);
    context.lineTo(px + CELL - 2, py + 8);
    context.closePath();
    context.fill();
    context.fillStyle = "#353129";
    context.fillRect(px + 9, py + 12, 6, 10);
    context.restore();

    for (let i = 0; i < base.hp; i += 1) {
      context.fillStyle = "#f3c849";
      context.fillRect(px + 4 + i * 6, py + CELL - 4, 4, 2);
    }
  }

  function drawItem(item) {
    const center = cellCenter(item.x, item.y);
    const pulse = 1 + Math.sin(item.pulse / 130) * 0.08;
    context.save();
    context.translate(center.x, center.y);
    context.scale(pulse, pulse);

    if (item.type === "shield") {
      context.strokeStyle = "#55d9dc";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 7, Math.PI * 0.1, Math.PI * 0.9);
      context.quadraticCurveTo(5, 9, 0, 10);
      context.quadraticCurveTo(-5, 9, -7, 2);
      context.stroke();
    } else if (item.type === "laser") {
      context.strokeStyle = "#f3c849";
      context.lineWidth = 2;
      context.strokeRect(-6, -6, 12, 12);
      context.fillStyle = "#fff1a7";
      context.fillRect(-2, -9, 4, 18);
      context.fillRect(-9, -2, 18, 4);
    } else {
      context.fillStyle = "#4a2520";
      context.beginPath();
      context.arc(0, 0, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ef6b4f";
      context.lineWidth = 3;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        context.beginPath();
        context.moveTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
        context.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
        context.stroke();
      }
    }
    context.restore();
  }

  function drawBullet(bullet) {
    const center = cellCenter(bullet.x, bullet.y);
    context.fillStyle = bullet.owner === "player" ? "#fff4a8" : "#ff806b";
    context.shadowColor = context.fillStyle;
    context.shadowBlur = 7;
    context.beginPath();
    context.arc(center.x, center.y, 3, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  function drawEffect(effect) {
    const center = cellCenter(effect.x, effect.y);
    if (effect.type === "laser") {
      const vector = DIRECTIONS[effect.dir];
      context.strokeStyle = "rgba(255, 238, 129, 0.9)";
      context.lineWidth = 5;
      context.shadowColor = "#f3c849";
      context.shadowBlur = 12;
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(
        vector.x > 0 ? canvas.width : vector.x < 0 ? 0 : center.x,
        vector.y > 0 ? canvas.height : vector.y < 0 ? 0 : center.y,
      );
      context.stroke();
      context.shadowBlur = 0;
      return;
    }

    const remaining = Math.max(0, (effect.expires - state.elapsed) / 320);
    if (effect.type === "explosion") {
      context.fillStyle = effect.color;
      context.globalAlpha = remaining;
      context.beginPath();
      context.arc(center.x, center.y, 4 + (1 - remaining) * 15, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    } else {
      context.strokeStyle = "#fff5cf";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(center.x - 6, center.y - 6);
      context.lineTo(center.x + 6, center.y + 6);
      context.moveTo(center.x + 6, center.y - 6);
      context.lineTo(center.x - 6, center.y + 6);
      context.stroke();
    }
  }

  function drawSpawnMarker() {
    const center = cellCenter(state.spawn.x, state.spawn.y);
    context.strokeStyle = `rgba(235, 96, 70, ${0.3 + Math.sin(state.elapsed / 180) * 0.12})`;
    context.lineWidth = 1;
    context.strokeRect(center.x - 9, center.y - 9, 18, 18);
  }

  function playTone(frequency, duration, wave, volume) {
    if (muted) return;
    try {
      audioContext ||= new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = wave;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      muted = true;
    }
  }

  function gameLoop(now) {
    const delta = Math.min(50, now - lastFrame);
    lastFrame = now;
    update(delta);
    draw();
    requestAnimationFrame(gameLoop);
  }

  function handleAction(action) {
    if (action === "attack") attackPlayer();
    else movePlayer(action);
  }

  window.addEventListener("keydown", (event) => {
    const keyActions = {
      ArrowUp: "up",
      ArrowRight: "right",
      ArrowDown: "down",
      ArrowLeft: "left",
      x: "attack",
      X: "attack",
    };
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    handleAction(action);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handleAction(button.dataset.action);
      canvas.focus({ preventScroll: true });
    });
  });

  document.querySelector("#restart-button").addEventListener("click", resetGame);
  document.querySelector("#overlay-restart").addEventListener("click", resetGame);
  document.querySelector("#mute-button").addEventListener("click", (event) => {
    muted = !muted;
    event.currentTarget.classList.toggle("is-muted", muted);
    event.currentTarget.querySelector("span").textContent = muted ? "×" : "♪";
    event.currentTarget.setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
  });

  resetGame();
  requestAnimationFrame(gameLoop);
})();
