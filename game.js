(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayBody = document.getElementById("overlay-body");
  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const waveLabel = document.getElementById("wave-label");
  const enemyLabel = document.getElementById("enemy-label");
  const powerLabel = document.getElementById("power-label");
  const messageLabel = document.getElementById("message-label");
  const musicToggle = document.getElementById("music-toggle");

  const GAME_WIDTH = 1280;
  const GAME_HEIGHT = 720;
  const WORLD_WIDTH = 2800;
  const GROUND_Y = 580;
  const GRAVITY = 2200;

  const config = {
    playerSpeed: 360,
    jumpVelocity: -900,
    throwCooldown: 0.42,
    enemyThrowCooldown: 0.96,
    projectileSpeed: 640,
    enemyBaseSpeed: 110,
  };

  const difficultyPalette = [
    { name: "ミント", color: "#d8f7a1", speed: 0.9, cadence: 1.7, hp: 1, projectileSpeed: 0.7 },
    { name: "レモン", color: "#ffe37a", speed: 1, cadence: 1.3, hp: 1, projectileSpeed: 0.9 },
    { name: "オレンジ", color: "#ffb454", speed: 1.1, cadence: 1.0, hp: 1, projectileSpeed: 1.05 },
    { name: "キャラメル", color: "#c28551", speed: 1.24, cadence: 0.82, hp: 2, projectileSpeed: 1.16 },
    { name: "ビター", color: "#7c4e31", speed: 1.38, cadence: 0.7, hp: 3, projectileSpeed: 1.3 },
  ];

  const input = {
    left: false,
    right: false,
    jump: false,
    throw: false,
  };

  const state = {
    running: false,
    gameOver: false,
    wave: 1,
    score: 0,
    cameraX: 0,
    enemies: [],
    projectiles: [],
    particles: [],
    clouds: [],
    stompBursts: [],
    player: null,
    lastTime: 0,
    message: "タップでスタート",
  };

  const audio = createAudioController();
  const spriteCache = createSpriteCache();

  function resetGame() {
    state.running = false;
    state.gameOver = false;
    state.wave = 1;
    state.score = 0;
    state.cameraX = 0;
    state.enemies = [];
    state.projectiles = [];
    state.particles = [];
    state.stompBursts = [];
    state.clouds = createClouds();
    state.player = createPlayer();
    state.lastTime = 0;
    setMessage("タップでスタート");
    spawnWave(state.wave);
    syncHud();
    showOverlay(
      "うんこ君を操作しよう",
      "左右移動、ジャンプ、うんこ投げで敵を倒す。1発でも当たるとやられるぞ。"
    );
  }

  function createPlayer() {
    return {
      kind: "player",
      x: 280,
      y: GROUND_Y - 128,
      width: 88,
      height: 128,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      throwCooldown: 0,
      jumpBuffer: 0,
      animationTime: 0,
      state: "idle",
      lives: 1,
      invulnerable: 0,
    };
  }

  function createClouds() {
    return Array.from({ length: 9 }, (_, index) => ({
      x: index * 320 + 80,
      y: 80 + Math.random() * 190,
      radius: 34 + Math.random() * 28,
      speed: 8 + Math.random() * 10,
    }));
  }

  function spawnWave(wave) {
    state.enemies = [];
    const enemyCount = Math.min(3 + wave, 11);
    for (let i = 0; i < enemyCount; i += 1) {
      const tier = Math.min(
        difficultyPalette.length - 1,
        Math.floor((wave - 1 + i * 0.45) / 2)
      );
      state.enemies.push(createEnemy(i, difficultyPalette[tier]));
    }
    syncHud();
  }

  function createEnemy(index, tier) {
    const laneOffset = 140 + index * 180 + Math.random() * 120;
    return {
      kind: "enemy",
      x: WORLD_WIDTH - laneOffset,
      y: GROUND_Y - 118,
      width: 82,
      height: 118,
      vx: 0,
      vy: 0,
      facing: -1,
      onGround: true,
      throwCooldown: 0.8 + Math.random() * 1.2,
      animationTime: Math.random(),
      state: "idle",
      hp: tier.hp,
      maxHp: tier.hp,
      palette: tier,
      invulnerable: 0,
      walkSeed: Math.random() * Math.PI * 2,
    };
  }

  function setMessage(text) {
    state.message = text;
    messageLabel.textContent = text;
  }

  function syncHud() {
    waveLabel.textContent = String(state.wave);
    enemyLabel.textContent = String(state.enemies.length);
    powerLabel.textContent = state.wave < 3 ? "ふつう" : state.wave < 5 ? "つよめ" : "ガチ";
  }

  function showOverlay(title, text) {
    overlay.classList.add("is-visible");
    overlayKicker.textContent = state.gameOver ? "やられると最初から" : "ゆるくて激しい 2D バトル";
    overlayTitle.textContent = title;
    overlayBody.innerHTML = text;
  }

  function hideOverlay() {
    overlay.classList.remove("is-visible");
  }

  function beginRun() {
    if (!audio.started) {
      audio.start();
    }
    state.running = true;
    state.gameOver = false;
    state.lastTime = 0;
    setMessage("うんこ発射で敵を片づけろ");
    hideOverlay();
  }

  function gameOver() {
    state.running = false;
    state.gameOver = true;
    createBurst(state.player.x + state.player.width / 2, state.player.y + 40, "#6f4a2c", 30, 260);
    audio.playExplosion();
    setMessage("やられた… もういちど！");
    showOverlay("GAME OVER", "茶色い嵐にのまれた。スタートで同じWAVEから再開はしない、最初からやりなおし。");
  }

  function nextWave() {
    state.wave += 1;
    spawnWave(state.wave);
    setMessage(`WAVE ${state.wave} 開始！`);
    audio.playWave();
  }

  function fireProjectile(owner) {
    const fromPlayer = owner.kind === "player";
    const direction = owner.facing || (fromPlayer ? 1 : -1);
    const size = fromPlayer ? 22 : 20;
    const palette = fromPlayer ? "#7d5129" : owner.palette.color;
    state.projectiles.push({
      x: owner.x + owner.width / 2 + direction * 14,
      y: owner.y + 42,
      vx: direction * config.projectileSpeed * (fromPlayer ? 1 : owner.palette.projectileSpeed),
      vy: -30 - Math.random() * 20,
      radius: size,
      owner: owner.kind,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() * 2 - 1) * 7,
      color: palette,
    });
    owner.throwCooldown = fromPlayer
      ? config.throwCooldown
      : config.enemyThrowCooldown * owner.palette.cadence;
    owner.state = "throw";
    audio.playThrow(fromPlayer);
  }

  function hitEntity(target, projectile) {
    createBurst(projectile.x, projectile.y, projectile.color, 18, 220);
    audio.playExplosion();

    if (target.kind === "enemy") {
      target.hp -= 1;
      target.invulnerable = 0.12;
      target.state = "hit";
      if (target.hp <= 0) {
        createBurst(target.x + target.width / 2, target.y + 54, target.palette.color, 32, 280);
        state.enemies = state.enemies.filter((enemy) => enemy !== target);
        enemyLabel.textContent = String(state.enemies.length);
        setMessage(`敵をやっつけた！ 残り ${state.enemies.length}`);
        if (state.enemies.length === 0) {
          nextWave();
        }
      }
      return;
    }

    if (target.kind === "player" && target.invulnerable <= 0) {
      target.invulnerable = 0.18;
      target.state = "hit";
      gameOver();
    }
  }

  function createBurst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const speed = power * (0.35 + Math.random() * 0.65);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 0.7 + Math.random() * 0.5,
        size: 5 + Math.random() * 11,
        color,
      });
    }
  }

  function update(dt) {
    updateClouds(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateCamera(dt);
    checkWaveClear();
  }

  function updateClouds(dt) {
    for (const cloud of state.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x - cloud.radius * 3 > WORLD_WIDTH + 200) {
        cloud.x = -200;
      }
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    player.animationTime += dt;
    player.throwCooldown = Math.max(0, player.throwCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    let axis = 0;
    if (input.left) {
      axis -= 1;
    }
    if (input.right) {
      axis += 1;
    }

    player.vx = axis * config.playerSpeed;
    if (axis !== 0) {
      player.facing = axis;
    }

    if (input.jump && player.onGround) {
      player.vy = config.jumpVelocity;
      player.onGround = false;
      player.state = "jump";
      audio.playJump();
      spawnDust(player.x + player.width / 2, GROUND_Y - 14, "#fff6d0");
    }

    if (input.throw && player.throwCooldown <= 0) {
      fireProjectile(player);
    }

    integrateBody(player, dt);

    if (player.invulnerable <= 0) {
      if (!player.onGround) {
        player.state = "jump";
      } else if (Math.abs(player.vx) > 0) {
        player.state = "run";
      } else if (player.throwCooldown > config.throwCooldown - 0.12) {
        player.state = "throw";
      } else {
        player.state = "idle";
      }
    }
  }

  function updateEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      enemy.animationTime += dt;
      enemy.throwCooldown = Math.max(0, enemy.throwCooldown - dt);
      enemy.invulnerable = Math.max(0, enemy.invulnerable - dt);

      const direction = player.x < enemy.x ? -1 : 1;
      enemy.facing = direction;
      const distance = Math.abs(player.x - enemy.x);

      if (distance > 270) {
        enemy.vx = direction * config.enemyBaseSpeed * enemy.palette.speed;
      } else if (distance < 170) {
        enemy.vx = -direction * config.enemyBaseSpeed * 0.55;
      } else {
        enemy.vx = Math.sin(enemy.animationTime * 1.8 + enemy.walkSeed) * 24;
      }

      if (enemy.onGround && Math.random() < 0.0035 * enemy.palette.speed && distance < 440) {
        enemy.vy = -760;
        enemy.onGround = false;
      }

      if (enemy.throwCooldown <= 0 && distance < 720) {
        fireProjectile(enemy);
      }

      integrateBody(enemy, dt);

      if (enemy.invulnerable <= 0) {
        if (!enemy.onGround) {
          enemy.state = "jump";
        } else if (Math.abs(enemy.vx) > 15) {
          enemy.state = "run";
        } else if (enemy.throwCooldown > config.enemyThrowCooldown * enemy.palette.cadence - 0.1) {
          enemy.state = "throw";
        } else {
          enemy.state = "idle";
        }
      }
    }
  }

  function integrateBody(body, dt) {
    body.vy += GRAVITY * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.x = clamp(body.x, 60, WORLD_WIDTH - body.width - 60);

    if (body.y + body.height >= GROUND_Y) {
      if (!body.onGround && body.vy > 120) {
        spawnDust(body.x + body.width / 2, GROUND_Y - 8, body.kind === "player" ? "#fff1d1" : body.palette.color);
      }
      body.y = GROUND_Y - body.height;
      body.vy = 0;
      body.onGround = true;
    } else {
      body.onGround = false;
    }
  }

  function spawnDust(x, y, color) {
    for (let i = 0; i < 9; i += 1) {
      state.stompBursts.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * 90,
        vy: -60 - Math.random() * 40,
        life: 0.34 + Math.random() * 0.2,
        maxLife: 0.34 + Math.random() * 0.2,
        color,
      });
    }
  }

  function updateProjectiles(dt) {
    const nextProjectiles = [];
    for (const projectile of state.projectiles) {
      projectile.vy += 520 * dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.rotation += projectile.spin * dt;

      const hitTarget =
        projectile.owner === "player"
          ? state.enemies.find((enemy) => isCircleRectCollision(projectile, enemy))
          : isCircleRectCollision(projectile, state.player)
            ? state.player
            : null;

      if (hitTarget) {
        hitEntity(hitTarget, projectile);
        continue;
      }

      if (projectile.y + projectile.radius > GROUND_Y) {
        createBurst(projectile.x, GROUND_Y - 6, projectile.color, 10, 150);
        continue;
      }

      if (projectile.x < -40 || projectile.x > WORLD_WIDTH + 40 || projectile.y > GAME_HEIGHT + 180) {
        continue;
      }

      nextProjectiles.push(projectile);
    }
    state.projectiles = nextProjectiles;
  }

  function updateParticles(dt) {
    const nextParticles = [];
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy += 780 * dt;
      if (particle.life > 0) {
        nextParticles.push(particle);
      }
    }
    state.particles = nextParticles;

    const nextBursts = [];
    for (const puff of state.stompBursts) {
      puff.life -= dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= 0.95;
      puff.vy += 240 * dt;
      if (puff.life > 0) {
        nextBursts.push(puff);
      }
    }
    state.stompBursts = nextBursts;
  }

  function updateCamera(dt) {
    const target = clamp(
      state.player.x + state.player.width / 2 - GAME_WIDTH / 2,
      0,
      WORLD_WIDTH - GAME_WIDTH
    );
    state.cameraX += (target - state.cameraX) * Math.min(1, dt * 5);
  }

  function checkWaveClear() {
    if (state.running && state.enemies.length === 0) {
      nextWave();
    }
  }

  function render() {
    renderSky();
    renderBackgroundHills();
    renderWorld();
    renderEffects();
  }

  function renderSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#9be8ff");
    gradient.addColorStop(0.58, "#ecfff8");
    gradient.addColorStop(1, "#ffe19c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const cloud of state.clouds) {
      const x = cloud.x - state.cameraX * 0.2;
      drawCloud(x, cloud.y, cloud.radius);
    }
  }

  function drawCloud(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.9, y + 10, radius * 0.8, 0, Math.PI * 2);
    ctx.arc(x - radius * 0.9, y + 12, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderBackgroundHills() {
    ctx.save();
    ctx.translate(-state.cameraX * 0.35, 0);
    ctx.fillStyle = "#98dd8f";
    for (let i = 0; i < 8; i += 1) {
      const x = i * 380 - 100;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 20);
      ctx.quadraticCurveTo(x + 160, 240, x + 340, GROUND_Y + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#7fc46d";
    for (let i = 0; i < 7; i += 1) {
      const x = i * 420 + 80;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 20);
      ctx.quadraticCurveTo(x + 180, 320, x + 360, GROUND_Y + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-state.cameraX * 0.6, 0);
    for (let i = 0; i < 16; i += 1) {
      const x = i * 220 + 30;
      const trunkY = GROUND_Y - 110 - (i % 3) * 18;
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(x, trunkY, 18, 110);
      ctx.fillStyle = i % 2 === 0 ? "#6ecb63" : "#84de72";
      ctx.beginPath();
      ctx.arc(x + 9, trunkY - 4, 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function renderWorld() {
    ctx.save();
    ctx.translate(-state.cameraX, 0);
    renderGround();

    const actors = [...state.enemies, state.player].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      renderCharacter(actor);
    }

    for (const projectile of state.projectiles) {
      renderProjectile(projectile);
    }
    ctx.restore();
  }

  function renderGround() {
    const dirtGradient = ctx.createLinearGradient(0, GROUND_Y, 0, GAME_HEIGHT);
    dirtGradient.addColorStop(0, "#8b5a31");
    dirtGradient.addColorStop(1, "#5d371c");
    ctx.fillStyle = dirtGradient;
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y);

    ctx.fillStyle = "#71ca5a";
    ctx.fillRect(0, GROUND_Y - 18, WORLD_WIDTH, 18);

    for (let i = 0; i < WORLD_WIDTH; i += 54) {
      ctx.fillStyle = i % 108 === 0 ? "rgba(255,255,255,0.12)" : "rgba(72,45,21,0.11)";
      ctx.fillRect(i, GROUND_Y + ((i / 54) % 2) * 8, 26, 6);
    }
  }

  function renderCharacter(actor) {
    const frame = getSpriteKey(actor);
    const sprite = actor.kind === "player"
      ? spriteCache.player[frame]
      : spriteCache.enemy.get(actor.palette.color, frame, frame === "hit");

    ctx.save();
    const centerX = actor.x + actor.width / 2;
    const centerY = actor.y + actor.height / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(actor.facing, 1);

    if (actor.invulnerable > 0) {
      ctx.globalAlpha = 0.65 + Math.sin(performance.now() * 0.05) * 0.2;
    }

    if (actor.kind === "enemy") {
      ctx.fillStyle = "rgba(41, 20, 10, 0.18)";
      ctx.fillRect(-34, actor.height / 2 + 6, 68, 10);
      renderEnemyHealth(actor);
    }

    ctx.drawImage(sprite, -52, -74, 104, 148);
    ctx.restore();
  }

  function renderEnemyHealth(enemy) {
    const w = 58;
    const h = 8;
    ctx.fillStyle = "rgba(59, 26, 10, 0.18)";
    ctx.fillRect(-w / 2, -92, w, h);
    ctx.fillStyle = enemy.palette.color;
    ctx.fillRect(-w / 2, -92, w * (enemy.hp / enemy.maxHp), h);
  }

  function renderProjectile(projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.rotation);
    const scale = projectile.radius / 24;
    ctx.scale(scale, scale);
    drawPoopBlob(ctx, {
      fill: projectile.color,
      shadow: "rgba(0, 0, 0, 0.12)",
      face: false,
      eyeMode: "none",
      mouthMode: "none",
    });
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-8, -24, 4, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function renderEffects() {
    ctx.save();
    ctx.translate(-state.cameraX, 0);

    for (const puff of state.stompBursts) {
      const alpha = puff.life / puff.maxLife;
      ctx.fillStyle = hexToRgba(puff.color, alpha);
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, 12 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const particle of state.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.fillStyle = hexToRgba(particle.color, alpha);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function getSpriteKey(actor) {
    if (actor.state === "hit") {
      return "hit";
    }

    if (actor.state === "throw") {
      return "throw";
    }

    if (actor.state === "jump") {
      return actor.vy < 0 ? "jumpUp" : "jumpDown";
    }

    if (actor.state === "run") {
      return Math.floor(actor.animationTime * 10) % 2 === 0 ? "runA" : "runB";
    }

    return "idle";
  }

  function createSpriteCache() {
    const enemy = {
      memo: new Map(),
      get(color, pose, hit) {
        const body = hit ? darken(color, 0.22) : color;
        const belt = hit ? "#f5dec2" : "#3f2211";
        const key = `${body}:${belt}:${pose}`;
        if (!enemy.memo.has(key)) {
          enemy.memo.set(key, makeCharacterSprite({ body, belt, kind: "enemy", pose }));
        }
        return enemy.memo.get(key);
      },
    };

    return {
      player: {
        idle: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "idle" }),
        runA: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "runA" }),
        runB: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "runB" }),
        jumpUp: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "jumpUp" }),
        jumpDown: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "jumpDown" }),
        throw: makeCharacterSprite({ body: "#8c5b30", belt: "#ffb83f", kind: "player", pose: "throw" }),
        hit: makeCharacterSprite({ body: "#633d1d", belt: "#f04d2c", kind: "player", pose: "hit" }),
      },
      enemy,
    };
  }

  function makeCharacterSprite({ body, belt, kind, pose }) {
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = 104;
    spriteCanvas.height = 148;
    const spriteCtx = spriteCanvas.getContext("2d");

    const poseMap = {
      idle: { arm: 0, legA: 0, legB: 0, eye: 0, tilt: 0, stretch: 1 },
      runA: { arm: 10, legA: 18, legB: -18, eye: 1, tilt: -0.03, stretch: 1.02 },
      runB: { arm: -10, legA: -18, legB: 18, eye: 1, tilt: 0.03, stretch: 0.98 },
      jumpUp: { arm: -24, legA: -8, legB: -8, eye: 2, tilt: -0.05, stretch: 1.08 },
      jumpDown: { arm: 18, legA: 10, legB: 10, eye: 2, tilt: 0.05, stretch: 0.92 },
      throw: { arm: 28, legA: 6, legB: -6, eye: 3, tilt: 0.08, stretch: 1 },
      hit: { arm: -34, legA: 14, legB: 14, eye: 4, tilt: 0.22, stretch: 0.88 },
    };
    const poseInfo = poseMap[pose];

    spriteCtx.translate(52, 78);
    spriteCtx.rotate(poseInfo.tilt);
    spriteCtx.scale(1, poseInfo.stretch);

    spriteCtx.fillStyle = "rgba(52, 29, 15, 0.16)";
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 50, 34, 11, 0, 0, Math.PI * 2);
    spriteCtx.fill();

    spriteCtx.lineCap = "round";
    spriteCtx.strokeStyle = kind === "player" ? "#4a2911" : "#3b2115";
    spriteCtx.lineWidth = 10;
    drawLimb(spriteCtx, -22, 4, -38, 18, -poseInfo.arm * 0.6);
    drawLimb(spriteCtx, 22, 4, 38, 18, poseInfo.arm);
    drawLimb(spriteCtx, -14, 42, -16, 66, poseInfo.legA);
    drawLimb(spriteCtx, 14, 42, 16, 66, poseInfo.legB);
    drawFoot(spriteCtx, -16, 68, kind === "player" ? "#563017" : "#4a2a17");
    drawFoot(spriteCtx, 16, 68, kind === "player" ? "#563017" : "#4a2a17");

    drawPoopBlob(spriteCtx, {
      fill: body,
      shadow: darken(body, 0.24),
      face: true,
      eyeMode: poseInfo.eye,
      mouthMode: pose === "throw" ? "throw" : pose === "hit" ? "hit" : "happy",
    });

    return spriteCanvas;
  }

  function drawLimb(context, x1, y1, x2, y2, rotation) {
    context.save();
    context.translate(x1, y1);
    context.rotate((rotation * Math.PI) / 180);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(x2 - x1, y2 - y1);
    context.stroke();
    context.restore();
  }

  function drawFoot(context, x, y, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawPoopBlob(context, options) {
    const { fill, shadow, face, eyeMode, mouthMode } = options;

    context.save();
    context.fillStyle = fill;
    context.beginPath();
    context.ellipse(0, 28, 44, 28, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, -2, 36, 24, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, -28, 26, 18, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-8, -38);
    context.bezierCurveTo(0, -54, 18, -60, 8, -76);
    context.bezierCurveTo(24, -64, 28, -46, 10, -32);
    context.bezierCurveTo(2, -26, -6, -30, -8, -38);
    context.fill();

    context.fillStyle = shadow;
    context.globalAlpha = 0.12;
    context.beginPath();
    context.ellipse(0, 36, 40, 16, 0, 0, Math.PI);
    context.fill();
    context.restore();

    if (!face) {
      return;
    }

    drawPoopFace(context, eyeMode, mouthMode);
  }

  function drawPoopFace(context, eyeMode, mouthMode) {
    if (eyeMode === 4) {
      drawCrossEye(context, -18, -6);
      drawCrossEye(context, 18, -6);
    } else {
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.ellipse(-18, -4, 14, 18, 0, 0, Math.PI * 2);
      context.ellipse(18, -4, 14, 18, 0, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#050505";
      const pupilOffset = eyeMode === 3 ? 4 : eyeMode === 2 ? -2 : 0;
      const pupilHeight = eyeMode === 2 ? 13 : 11;
      context.beginPath();
      context.ellipse(-18 + pupilOffset, -4, 6.4, pupilHeight, 0, 0, Math.PI * 2);
      context.ellipse(18 + pupilOffset, -4, 6.4, pupilHeight, 0, 0, Math.PI * 2);
      context.fill();
    }

    if (mouthMode === "none") {
      return;
    }

    if (mouthMode === "hit") {
      context.strokeStyle = "#ffffff";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(-12, 24);
      context.lineTo(12, 24);
      context.stroke();
      return;
    }

    if (mouthMode === "throw") {
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.ellipse(0, 24, 14, 10, 0, 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(-18, 18);
    context.quadraticCurveTo(0, 34, 18, 18);
    context.lineTo(13, 28);
    context.quadraticCurveTo(0, 38, -13, 28);
    context.closePath();
    context.fill();
  }

  function drawCrossEye(context, x, y) {
    context.strokeStyle = "#050505";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x - 6, y - 8);
    context.lineTo(x + 6, y + 8);
    context.moveTo(x + 6, y - 8);
    context.lineTo(x - 6, y + 8);
    context.stroke();
  }

  function isCircleRectCollision(circle, rect) {
    const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function darken(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
  }

  function hexToRgb(hex) {
    if (hex.startsWith("rgb")) {
      const matches = hex.match(/\d+/g).map(Number);
      return matches;
    }
    const normalized = hex.replace("#", "");
    const size = normalized.length === 3 ? 1 : 2;
    const values = [];
    for (let i = 0; i < normalized.length; i += size) {
      const segment = normalized.slice(i, i + size);
      values.push(parseInt(size === 1 ? segment + segment : segment, 16));
    }
    return values;
  }

  function hexToRgba(color, alpha) {
    const [r, g, b] = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function createAudioController() {
    const controller = {
      context: null,
      master: null,
      started: false,
      enabled: false,
      loopInterval: null,
      melodyIndex: 0,
      updateButton() {
        musicToggle.setAttribute("aria-pressed", String(controller.enabled));
        musicToggle.textContent = controller.enabled ? "音ON" : "音OFF";
      },
      withContextReady(callback) {
        if (!controller.context || typeof controller.context.resume !== "function") {
          callback();
          return;
        }

        try {
          const result = controller.context.resume();
          if (result && typeof result.then === "function") {
            result.then(callback).catch(callback);
            return;
          }
        } catch (error) {
          callback();
          return;
        }

        callback();
      },
      playReady() {
        controller.beep("triangle", 740, 0.14, 0, 0.11);
        window.setTimeout(() => controller.beep("square", 987, 0.1, 0, 0.08), 110);
      },
      start() {
        if (controller.started) {
          controller.enabled = true;
          controller.withContextReady(() => {
            controller.master.gain.setTargetAtTime(0.16, controller.context.currentTime, 0.03);
            controller.playReady();
          });
          controller.updateButton();
          return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }

        controller.context = new AudioContextClass();
        controller.master = controller.context.createGain();
        controller.master.gain.value = 0;
        controller.master.connect(controller.context.destination);
        controller.started = true;
        controller.enabled = true;
        controller.startLoop();
        controller.withContextReady(() => {
          controller.master.gain.setTargetAtTime(0.16, controller.context.currentTime, 0.03);
          controller.playReady();
        });
        controller.updateButton();
      },
      toggle() {
        if (!controller.started) {
          controller.start();
          return;
        }
        controller.enabled = !controller.enabled;
        controller.withContextReady(() => {
          controller.master.gain.setTargetAtTime(
            controller.enabled ? 0.16 : 0,
            controller.context.currentTime,
            0.03
          );
          if (controller.enabled) {
            controller.playReady();
          }
        });
        controller.updateButton();
      },
      beep(type, frequency, duration, detune, volume) {
        if (!controller.started || !controller.enabled) {
          return;
        }

        const oscillator = controller.context.createOscillator();
        const gain = controller.context.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune || 0;
        gain.gain.value = volume;
        oscillator.connect(gain);
        gain.connect(controller.master);

        const now = controller.context.currentTime;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.start(now);
        oscillator.stop(now + duration);
      },
      noise(duration, volume) {
        if (!controller.started || !controller.enabled) {
          return;
        }

        const buffer = controller.context.createBuffer(1, controller.context.sampleRate * duration, controller.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * 0.6;
        }

        const source = controller.context.createBufferSource();
        const filter = controller.context.createBiquadFilter();
        const gain = controller.context.createGain();
        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.value = 920;
        gain.gain.value = volume;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(controller.master);
        gain.gain.exponentialRampToValueAtTime(0.0001, controller.context.currentTime + duration);
        source.start();
      },
      startLoop() {
        if (controller.loopInterval) {
          clearInterval(controller.loopInterval);
        }
        const melody = [392, 440, 523.25, 440, 349.23, 392, 523.25, 587.33];
        controller.loopInterval = window.setInterval(() => {
          if (!controller.enabled || !controller.started) {
            return;
          }
          const note = melody[controller.melodyIndex % melody.length];
          controller.beep("triangle", note, 0.24, 0, 0.07);
          controller.beep("square", note / 2, 0.18, 0, 0.04);
          controller.melodyIndex += 1;
        }, 320);
      },
      playThrow(isPlayer) {
        controller.beep("square", isPlayer ? 320 : 220, 0.12, isPlayer ? 80 : -40, 0.09);
      },
      playJump() {
        controller.beep("triangle", 260, 0.16, 160, 0.1);
      },
      playExplosion() {
        controller.noise(0.18, 0.12);
        controller.beep("sawtooth", 160, 0.18, -600, 0.08);
      },
      playWave() {
        controller.beep("triangle", 660, 0.18, 0, 0.08);
        window.setTimeout(() => controller.beep("triangle", 880, 0.18, 0, 0.08), 120);
      },
    };

    return controller;
  }

  function setupEvents() {
    const unlockAudio = () => {
      if (!audio.started || (audio.context && audio.context.state === "suspended")) {
        audio.start();
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });

    const controlButtons = document.querySelectorAll("[data-control]");
    for (const button of controlButtons) {
      const control = button.dataset.control;
      const press = (event) => {
        event.preventDefault();
        input[control] = true;
        button.classList.add("is-active");
        if (!state.running && !state.gameOver) {
          beginRun();
        }
      };
      const release = (event) => {
        event.preventDefault();
        input[control] = false;
        button.classList.remove("is-active");
      };

      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointerleave", release);
      button.addEventListener("pointercancel", release);
    }

    window.addEventListener("keydown", (event) => {
      unlockAudio();
      if (event.repeat) {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
        }
        return;
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        input.left = true;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        input.right = true;
      }
      if (event.code === "Space") {
        input.jump = true;
        event.preventDefault();
      }
      if (event.code === "Enter" || event.code === "KeyF") {
        input.throw = true;
        event.preventDefault();
      }

      if (!state.running && !state.gameOver && ["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space", "Enter", "KeyF"].includes(event.code)) {
        beginRun();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        input.left = false;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        input.right = false;
      }
      if (event.code === "Space") {
        input.jump = false;
      }
      if (event.code === "Enter" || event.code === "KeyF") {
        input.throw = false;
      }
    });

    startButton.addEventListener("click", () => {
      if (state.gameOver) {
        resetGame();
      }
      beginRun();
    });

    restartButton.addEventListener("click", () => {
      resetGame();
    });

    musicToggle.addEventListener("click", () => {
      audio.toggle();
    });

    canvas.addEventListener("pointerdown", () => {
      if (!state.running && !state.gameOver) {
        beginRun();
      }
    });

    window.addEventListener(
      "blur",
      () => {
        input.left = false;
        input.right = false;
        input.jump = false;
        input.throw = false;
      },
      { passive: true }
    );
  }

  function loop(timestamp) {
    if (state.lastTime === 0) {
      state.lastTime = timestamp;
    }
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.033);
    state.lastTime = timestamp;

    if (state.running && !state.gameOver) {
      update(dt);
    } else {
      updateClouds(dt);
      updateParticles(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  setupEvents();
  resetGame();
  requestAnimationFrame(loop);
})();
