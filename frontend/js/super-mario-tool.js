// Starpath Island: an original, locally rendered side-scrolling platform game.
var SuperMarioTool = (function () {
  "use strict";
  var HEIGHT = 540, GROUND = 438, WORLD = 5300, GRAVITY = 1650;
  var BEST_KEY = "devtools_starpath_best_v1";
  var root, canvas, ctx, viewportWidth = 960, pixelRatio = 1, resizeObserver;
  var level, state, frame = 0, last = 0, controls = {}, active = false, audioContext = null;
  var keyDownHandler, keyUpHandler, visibilityHandler;
  function t(key) { return (window.__t && window.__t("superMario." + key)) || key; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function onGroundAt(x, ground) { return ground.some(function (piece) { return x >= piece.x && x <= piece.x + piece.w; }); }
  function bestScore() { try { return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); } catch (_) { return 0; } }
  function saveBest(value) { try { localStorage.setItem(BEST_KEY, String(value)); } catch (_) { /* private browsing */ } }
  function makeLevel() {
    var ground = [
      { x: 0, w: 1180 }, { x: 1300, w: 1340 },
      { x: 2770, w: 1180 }, { x: 4080, w: 1220 }
    ];
    var platforms = [
      [310, 347, 145], [535, 288, 118], [850, 352, 134],
      [1160, 360, 126], [1435, 360, 130], [1675, 315, 150], [1950, 355, 115],
      [2200, 303, 145], [2515, 350, 130], [2635, 365, 120], [2820, 365, 115],
      [3155, 333, 165], [3420, 278, 110], [3700, 350, 145],
      [3915, 353, 132], [4085, 357, 115], [4350, 330, 140], [4580, 280, 118]
    ].map(function (p) { return { x: p[0], y: p[1], w: p[2], h: 19, kind: "platform" }; });
    var blocks = [
      [470, 316, "coin"], [508, 316, "shield"], [547, 316, "coin"],
      [925, 315, "coin"], [1720, 266, "coin"], [1760, 266, "shield"],
      [2230, 251, "coin"], [3295, 303, "coin"], [3470, 226, "shield"],
      [4440, 265, "coin"], [4480, 265, "coin"]
    ].map(function (b) { return { x: b[0], y: b[1], w: 38, h: 38, kind: "block", reward: b[2], used: false, bump: 0 }; });
    var coins = [];
    function coinLine(x, y, count, spacing) {
      for (var i = 0; i < count; i++) coins.push({ x: x + i * spacing, y: y, taken: false });
    }
    coinLine(215, 355, 4, 38); coinLine(335, 307, 3, 38);
    coinLine(662, 362, 5, 38); coinLine(1004, 357, 4, 37);
    coinLine(1194, 303, 3, 42); coinLine(1465, 318, 4, 40);
    coinLine(1815, 350, 5, 39); coinLine(2010, 305, 4, 38);
    coinLine(2465, 355, 4, 37); coinLine(2660, 307, 3, 44);
    coinLine(2900, 347, 5, 38); coinLine(3180, 291, 4, 40);
    coinLine(3580, 352, 5, 38); coinLine(3970, 300, 3, 44);
    coinLine(4210, 353, 5, 39); coinLine(4610, 235, 3, 38);
    var enemies = [
      [715, 637, 807, "moss"], [1065, 1002, 1125, "moss"],
      [1510, 1470, 1620, "moss"], [1900, 1850, 1980, "moss"],
      [2360, 2310, 2500, "bat"], [2890, 2830, 3030, "moss"],
      [3220, 3120, 3390, "moss"], [3640, 3540, 3800, "bat"],
      [4280, 4210, 4410, "moss"], [4690, 4630, 4820, "moss"]
    ].map(function (e) { return { x: e[0], startX: e[0], minX: e[1], maxX: e[2],
      y: e[3] === "bat" ? 295 : GROUND - 28, w: e[3] === "bat" ? 36 : 34,
      h: e[3] === "bat" ? 28 : 28, kind: e[3], direction: -1, alive: true, phase: e[0] * .03 }; });
    var spikes = [1575, 2440, 3030, 3750, 4520].map(function (x) { return { x: x, y: GROUND - 18, w: 42, h: 18 }; });
    return { ground: ground, platforms: platforms, blocks: blocks, coins: coins,
      enemies: enemies, spikes: spikes, checkpoints: [1840, 3570],
      guardian: { x: 4930, startX: 4930, minX: 4840, maxX: 5050, y: GROUND - 58, w: 55, h: 58,
        hp: 2, direction: -1, invulnerable: 0 } };
  }
  function freshState() {
    return { phase: "ready", player: { x: 72, y: GROUND - 43, w: 28, h: 43, vx: 0, vy: 0,
      facing: 1, onGround: true, coyote: .1, jumpBuffer: 0, invulnerable: 0, shield: false },
      camera: 0, seconds: 180, elapsed: 0, score: 0, coins: 0, hearts: 3,
      checkpoint: 72, checkpointIndex: -1, best: bestScore(), message: "", messageTime: 0,
      musicClock: 0, musicNote: 0, particles: [], shake: 0, sparks: 0 };
  }
  function tone(frequency, duration, shape, volume, delay) {
    if (!state || state.muted) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      var start = audioContext.currentTime + (delay || 0);
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = shape || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || .045, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + duration + .01);
    } catch (_) { /* Sound is optional; game logic stays local and playable. */ }
  }
  function sound(kind) {
    if (kind === "coin") { tone(880, .13, "triangle", .06); tone(1320, .15, "triangle", .045, .08); }
    else if (kind === "jump") tone(390, .17, "square", .035);
    else if (kind === "stomp") { tone(230, .09, "square", .055); tone(460, .14, "triangle", .045, .06); }
    else if (kind === "hurt") tone(135, .24, "sawtooth", .065);
    else if (kind === "checkpoint") [523, 659, 784].forEach(function (n, i) { tone(n, .22, "triangle", .045, i * .1); });
    else if (kind === "win") [523, 659, 784, 1047].forEach(function (n, i) { tone(n, .38, "triangle", .05, i * .13); });
  }
  function music(dt) {
    if (state.muted || state.phase !== "running") return;
    state.musicClock += dt;
    if (state.musicClock < .245) return;
    state.musicClock -= .245;
    var notes = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 440, 392, 330, 294];
    var note = notes[state.musicNote++ % notes.length];
    tone(note, .14, "triangle", .018);
  }
  function burst(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var angle = i * Math.PI * 2 / count + Math.random() * .3;
      var speed = 60 + Math.random() * 130;
      state.particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 55,
        life: .55 + Math.random() * .25, color: color, size: 2 + Math.random() * 4 });
    }
  }
  function notify(key) {
    state.message = t(key); state.messageTime = 2.6;
    var element = root && root.querySelector("#super-toast");
    if (element) { element.textContent = state.message; element.classList.add("is-visible"); }
  }
  function overlay(title, detail, button) {
    var element = root.querySelector("#super-overlay"); element.hidden = false;
    element.querySelector("h3").textContent = t(title);
    element.querySelector("p").textContent = t(detail);
    element.querySelector("button").textContent = t(button);
  }
  function hideOverlay() { root.querySelector("#super-overlay").hidden = true; }
  function zoneFor(x) { return clamp(Math.floor(x / 1325), 0, 3); }
  function hud() {
    if (!root || !state) return;
    root.querySelector("#super-score").textContent = state.score.toLocaleString();
    root.querySelector("#super-coins").textContent = String(state.coins).padStart(2, "0");
    root.querySelector("#super-hearts").textContent = "♥".repeat(state.hearts) + "♡".repeat(3 - state.hearts);
    root.querySelector("#super-timer").textContent = String(Math.max(0, Math.ceil(state.seconds))).padStart(3, "0");
    root.querySelector("#super-world").textContent = t(["zoneMeadow", "zoneCanopy", "zoneTwilight", "zoneCitadel"][zoneFor(state.player.x)]);
    root.querySelector("#super-progress span").style.width = clamp(state.player.x / 5160 * 100, 0, 100) + "%";
    root.querySelector("#super-shield").hidden = !state.player.shield;
    root.querySelector("#super-sound").textContent = state.muted ? t("soundOff") : t("soundOn");
    root.querySelector("#super-pause").textContent = state.phase === "paused" ? t("resume") : t("pause");
    root.querySelector("#super-best").textContent = state.best.toLocaleString();
  }
  function awardCoin(x, y, amount) {
    state.coins += amount || 1; state.score += (amount || 1) * 100;
    burst(x, y, "#ffe48a", 7); sound("coin");
    if (state.coins >= 20 && state.coins - (amount || 1) < 20) notify("coinMilestone");
    if (state.coins % 20 < (amount || 1)) { state.hearts = Math.min(3, state.hearts + 1); notify("extraHeart"); }
  }
  function hitBlock(block) {
    if (block.used) return;
    block.used = true; block.bump = .22;
    burst(block.x + 19, block.y, "#ffd77c", 9);
    if (block.reward === "shield") { state.player.shield = true; notify("shieldFound"); sound("checkpoint"); }
    else awardCoin(block.x + 19, block.y, 3);
  }
  function damage() {
    var player = state.player;
    if (player.invulnerable > 0 || state.phase !== "running") return;
    if (player.shield) {
      player.shield = false; player.invulnerable = 1.1; state.shake = .2;
      burst(player.x + 14, player.y + 20, "#87e9ee", 14); sound("hurt"); notify("shieldLost"); return;
    }
    state.hearts--; state.shake = .35; sound("hurt");
    burst(player.x + 14, player.y + 20, "#ff866e", 16);
    if (state.hearts <= 0) { finish(false); return; }
    player.x = state.checkpoint; player.y = GROUND - player.h;
    player.vx = 0; player.vy = 0; player.onGround = true; player.invulnerable = 1.8;
    state.camera = clamp(player.x - viewportWidth * .32, 0, WORLD - viewportWidth);
    notify("tryAgain");
  }
  function finish(won) {
    if (state.phase !== "running") return;
    state.phase = won ? "win" : "lose";
    controls = {};
    if (won) { state.score += Math.ceil(state.seconds) * 10 + state.hearts * 250; sound("win"); }
    if (state.score > state.best) { state.best = state.score; saveBest(state.score); }
    overlay(won ? "winTitle" : "loseTitle", won ? "winText" : "loseText", "retry");
    hud();
  }
  function solids() {
    var blocks = level.blocks;
    return level.ground.map(function (g) { return { x: g.x, y: GROUND, w: g.w, h: HEIGHT + 100, kind: "ground" }; })
      .concat(level.platforms, blocks);
  }
  function updateEnemies(dt) {
    for (var enemy of level.enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.direction * (enemy.kind === "bat" ? 56 : 42) * dt;
      if (enemy.x <= enemy.minX || enemy.x >= enemy.maxX) enemy.direction *= -1;
      if (enemy.kind === "bat") enemy.y = 295 + Math.sin(state.elapsed * 3.6 + enemy.phase) * 26;
    }
    var guardian = level.guardian;
    if (guardian.hp > 0) {
      guardian.invulnerable = Math.max(0, guardian.invulnerable - dt);
      guardian.x += guardian.direction * 78 * dt;
      if (guardian.x <= guardian.minX || guardian.x >= guardian.maxX) guardian.direction *= -1;
    }
  }
  function collideFoes(previousBottom) {
    var player = state.player;
    for (var enemy of level.enemies) {
      if (!enemy.alive || !overlap(player, enemy)) continue;
      if (player.vy > 60 && previousBottom <= enemy.y + 12) {
        enemy.alive = false; player.y = enemy.y - player.h; player.vy = -420;
        state.score += 200; burst(enemy.x + 17, enemy.y + 12, "#b9ed8b", 12); sound("stomp");
      } else damage();
      if (state.phase !== "running") return;
    }
    var guardian = level.guardian;
    if (guardian.hp > 0 && overlap(player, guardian)) {
      if (player.vy > 60 && previousBottom <= guardian.y + 15 && guardian.invulnerable <= 0) {
        guardian.hp--; guardian.invulnerable = .8; player.y = guardian.y - player.h;
        player.vy = -455; state.score += 500;
        state.shake = .18; burst(guardian.x + 28, guardian.y + 10, "#ffcf7a", 18); sound("stomp");
        if (guardian.hp === 0) notify("guardianDown"); else notify("guardianHit");
      } else if (guardian.invulnerable <= 0) damage();
    }
    for (var spike of level.spikes) {
      if (overlap(player, { x: spike.x + 5, y: spike.y + 7, w: spike.w - 10, h: spike.h - 7 })) damage();
    }
  }
  function step(dt) {
    var player = state.player;
    state.elapsed += dt; state.seconds -= dt;
    if (state.seconds <= 0) { state.seconds = 0; finish(false); return; }
    state.messageTime = Math.max(0, state.messageTime - dt);
    if (state.messageTime === 0) { var toast = root.querySelector("#super-toast"); toast.classList.remove("is-visible"); }
    state.shake = Math.max(0, state.shake - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = player.onGround ? .11 : Math.max(0, player.coyote - dt);
    var axis = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    var target = axis * (controls.run ? 315 : 235);
    player.vx += (target - player.vx) * Math.min(1, dt * (player.onGround ? 15 : 8));
    if (axis) player.facing = axis;
    if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = -625; player.onGround = false; player.coyote = 0; player.jumpBuffer = 0; sound("jump");
      burst(player.x + 14, player.y + 43, "#f4dfba", 5);
    }
    var colliders = solids();
    player.x += player.vx * dt;
    player.x = clamp(player.x, 0, 5180);
    for (var horizontal of colliders) {
      if (!overlap(player, horizontal)) continue;
      if (player.vx > 0) player.x = horizontal.x - player.w;
      else if (player.vx < 0) player.x = horizontal.x + horizontal.w;
      player.vx = 0;
    }
    var previousTop = player.y, previousBottom = player.y + player.h;
    player.vy = Math.min(900, player.vy + GRAVITY * dt);
    if (!controls.jump && player.vy < -235) player.vy += GRAVITY * dt * 1.1;
    player.y += player.vy * dt;
    player.onGround = false;
    for (var vertical of colliders) {
      if (!overlap(player, vertical)) continue;
      if (player.vy >= 0 && previousBottom <= vertical.y + 7) {
        player.y = vertical.y - player.h; player.vy = 0; player.onGround = true;
      } else if (player.vy < 0 && previousTop >= vertical.y + vertical.h - 7) {
        player.y = vertical.y + vertical.h; player.vy = 0;
        if (vertical.kind === "block") hitBlock(vertical);
      }
    }
    if (player.y > HEIGHT + 50) {
      player.invulnerable = 0; player.shield = false; damage();
      if (state.phase !== "running") return;
    }
    updateEnemies(dt);
    collideFoes(previousBottom);
    if (state.phase !== "running") return;
    for (var coin of level.coins) {
      if (!coin.taken && Math.abs(player.x + player.w / 2 - coin.x) < 24 && Math.abs(player.y + player.h / 2 - coin.y) < 30) {
        coin.taken = true; awardCoin(coin.x, coin.y, 1);
      }
    }
    for (var i = 0; i < level.checkpoints.length; i++) {
      if (player.x >= level.checkpoints[i] && state.checkpointIndex < i) {
        state.checkpointIndex = i; state.checkpoint = level.checkpoints[i] + 22;
        state.score += 300; sound("checkpoint"); notify("checkpointReached");
      }
    }
    if (level.guardian.hp > 0 && player.x > 5082) { player.x = 5082; player.vx = 0; notify("guardianHint"); }
    if (level.guardian.hp === 0 && player.x >= 5160) finish(true);
    state.camera += (clamp(player.x - viewportWidth * .3, 0, WORLD - viewportWidth) - state.camera) * Math.min(1, dt * 6);
    for (var particle of state.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.vy += 400 * dt; particle.life -= dt;
    }
    state.particles = state.particles.filter(function (p) { return p.life > 0; });
    music(dt);
  }
  function blockRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function rounded(x, y, w, h, radius, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(Math.round(x), Math.round(y), w, h, radius); ctx.fill();
  }
  function hill(x, baseline, width, rise, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, baseline);
    ctx.quadraticCurveTo(x + width * .48, baseline - rise * 1.9, x + width, baseline);
    ctx.closePath(); ctx.fill();
  }
  function scenery() {
    var zone = zoneFor(state.player.x);
    var palettes = [
      ["#8bc5d4", "#f9ddb1", "#9ebdb1", "#678fa1", "#4f876b", "#274e52"],
      ["#87b9b4", "#e8d3ae", "#94b79d", "#648f86", "#3f755f", "#28524c"],
      ["#586f9f", "#e7a6a2", "#a18faa", "#676b98", "#4d6384", "#344560"],
      ["#233a59", "#8d879e", "#737b96", "#4e617f", "#4a596c", "#283d55"]
    ];
    var p = palettes[zone], gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, p[0]); gradient.addColorStop(.84, p[1]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, viewportWidth, HEIGHT);
    var sunX = viewportWidth * .78 - state.camera * .04;
    ctx.fillStyle = zone === 3 ? "#d8e2ed" : "#fff1c0";
    ctx.beginPath(); ctx.arc(sunX, zone === 3 ? 98 : 115, zone === 3 ? 25 : 36, 0, Math.PI * 2); ctx.fill();
    var far = state.camera * .13;
    for (var i = -1; i < 12; i++) hill(i * 220 - far % 220, 420, 255, 76 + (i % 3) * 18, p[2]);
    for (var j = -1; j < 10; j++) hill(j * 270 - state.camera * .28 % 270, 455, 295, 100 + (j % 3) * 20, p[3]);
    // Cloud groups move slowly, independent of game progress.
    for (var c = 0; c < 15; c++) {
      var cloudX = c * 220 - (state.camera * .22 + state.elapsed * 7) % (15 * 220);
      if (cloudX < -160 || cloudX > viewportWidth + 150) continue;
      var cloudY = 70 + (c * 47) % 84;
      rounded(cloudX, cloudY, 76, 17, 9, zone === 3 ? "#aab5cd" : "#f5f1de");
      rounded(cloudX + 20, cloudY - 16, 38, 30, 14, zone === 3 ? "#aab5cd" : "#f5f1de");
    }
    // Columns and foliage use a separate near parallax plane.
    ctx.save(); ctx.translate(-state.camera * .55, 0);
    for (var tree = 0; tree < 46; tree++) {
      var tx = tree * 135 + 105;
      if (tx - state.camera * .55 < -100 || tx - state.camera * .55 > viewportWidth + 110) continue;
      var size = 29 + tree % 4 * 8;
      blockRect(tx - 6, 347 - size, 12, size + 89, p[5]);
      ctx.fillStyle = p[4];
      ctx.beginPath(); ctx.arc(tx, 350 - size, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.16)";
      ctx.beginPath(); ctx.arc(tx - size * .3, 343 - size * 1.2, size * .3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (zone === 3) {
      var castleX = 4960 - state.camera * .76;
      blockRect(castleX, 275, 130, 160, "#34415a");
      blockRect(castleX + 17, 215, 30, 70, "#34415a");
      blockRect(castleX + 89, 230, 30, 55, "#34415a");
      rounded(castleX + 48, 352, 36, 84, 18, "#192c46");
      blockRect(castleX + 24, 295, 16, 25, "#e1c17e");
    }
  }
  function drawGround() {
    // Water beneath the gaps adds visual depth and makes the missing road readable.
    var water = ctx.createLinearGradient(0, GROUND, 0, HEIGHT);
    water.addColorStop(0, "#327e96"); water.addColorStop(1, "#1b526f");
    ctx.fillStyle = water; ctx.fillRect(0, GROUND, viewportWidth, HEIGHT - GROUND);
    ctx.strokeStyle = "rgba(210,244,225,.25)"; ctx.lineWidth = 2;
    for (var wave = 0; wave < 18; wave++) {
      var wx = (wave * 79 + state.elapsed * 17) % (viewportWidth + 90) - 40;
      var wy = GROUND + 15 + (wave * 29) % 90;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 34, wy); ctx.stroke();
    }
    var fill = zoneFor(state.player.x) === 3 ? "#5a5365" : "#705445";
    var seams = zoneFor(state.player.x) === 3 ? "#454658" : "#614938";
    for (var ground of level.ground) {
      if (ground.x + ground.w < state.camera - 50 || ground.x > state.camera + viewportWidth + 50) continue;
      blockRect(ground.x, GROUND, ground.w, HEIGHT - GROUND, fill);
      blockRect(ground.x, GROUND, ground.w, 12, zoneFor(ground.x) === 3 ? "#789196" : "#77ad77");
      blockRect(ground.x, GROUND + 12, ground.w, 5, "#a48a6b");
      for (var tx = Math.ceil(ground.x / 32) * 32; tx < ground.x + ground.w; tx += 32) {
        blockRect(tx, GROUND + 30 + (Math.floor(tx / 32) % 2) * 19, 24, 4, seams);
        blockRect(tx + 7, GROUND + 66 + (Math.floor(tx / 32) % 3) * 8, 8, 8, "#94745b");
      }
    }
    for (var platform of level.platforms) {
      blockRect(platform.x, platform.y + 5, platform.w, platform.h, "#755944");
      blockRect(platform.x, platform.y, platform.w, 8, "#7eb48b");
      for (var board = 8; board < platform.w; board += 28) blockRect(platform.x + board, platform.y + 10, 16, 2, "#a68058");
    }
  }
  function drawDecor() {
    for (var x = 135; x < WORLD; x += 153) {
      if (x < state.camera - 50 || x > state.camera + viewportWidth + 50 || !onGroundAt(x, level.ground)) continue;
      var zone = zoneFor(x);
      var stem = zone === 3 ? "#8c9aae" : "#4f866d";
      blockRect(x, GROUND - 17, 3, 17, stem);
      ctx.fillStyle = zone === 3 ? "#f9d59b" : ["#f1baaa", "#f5dca3", "#d4c5ed"][Math.floor(x / 153) % 3];
      for (var petal = 0; petal < 5; petal++) {
        var angle = petal * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 5, GROUND - 20 + Math.sin(angle) * 5, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#ffdf78"; ctx.beginPath(); ctx.arc(x, GROUND - 20, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (var checkpointIndex = 0; checkpointIndex < level.checkpoints.length; checkpointIndex++) {
      var checkpoint = level.checkpoints[checkpointIndex];
      blockRect(checkpoint, GROUND - 102, 5, 102, "#e8d8a7");
      ctx.fillStyle = checkpointIndex <= state.checkpointIndex ? "#ffe08a" : "#72bccc";
      ctx.beginPath(); ctx.moveTo(checkpoint + 5, GROUND - 100);
      ctx.lineTo(checkpoint + 48, GROUND - 86); ctx.lineTo(checkpoint + 5, GROUND - 69); ctx.closePath(); ctx.fill();
    }
  }
  function drawBlocksAndCoins() {
    for (var block of level.blocks) {
      var y = block.y - (block.bump > 0 ? Math.sin(block.bump / .22 * Math.PI) * 7 : 0);
      blockRect(block.x + 3, y + 5, 36, 37, "#8b5d47");
      blockRect(block.x, y, 38, 38, block.used ? "#8c9294" : "#e7a74d");
      blockRect(block.x + 4, y + 4, 30, 29, block.used ? "#b2ae9e" : "#ffd275");
      blockRect(block.x + 4, y + 4, 7, 6, "rgba(255,255,255,.35)");
      ctx.fillStyle = block.used ? "#687981" : "#98643b";
      ctx.font = "bold 25px system-ui"; ctx.textAlign = "center";
      ctx.fillText(block.used ? "·" : "✦", block.x + 19, y + 28);
    }
    for (var coin of level.coins) {
      if (coin.taken || coin.x < state.camera - 30 || coin.x > state.camera + viewportWidth + 30) continue;
      var bob = Math.sin(state.elapsed * 4 + coin.x * .08) * 3;
      ctx.fillStyle = "#a76c2a"; ctx.beginPath(); ctx.ellipse(coin.x + 2, coin.y + bob + 2, 12, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffdb73"; ctx.beginPath(); ctx.ellipse(coin.x, coin.y + bob, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff2b5"; ctx.fillRect(coin.x - 2, coin.y - 7 + bob, 4, 13);
    }
    for (var spike of level.spikes) {
      ctx.fillStyle = "#687581";
      for (var tooth = 0; tooth < 3; tooth++) {
        ctx.beginPath(); ctx.moveTo(spike.x + tooth * 14, GROUND);
        ctx.lineTo(spike.x + tooth * 14 + 7, GROUND - 20);
        ctx.lineTo(spike.x + tooth * 14 + 14, GROUND); ctx.fill();
      }
    }
  }
  function drawEnemy(enemy) {
    if (!enemy.alive) return;
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === "bat") {
      var flap = Math.sin(state.elapsed * 12 + enemy.phase) * 7;
      ctx.fillStyle = "#65517b";
      ctx.beginPath(); ctx.moveTo(17, 11); ctx.quadraticCurveTo(-8, -15 + flap, -5, 17);
      ctx.lineTo(17, 18); ctx.quadraticCurveTo(44, -15 + flap, 39, 17); ctx.fill();
      rounded(8, 8, 20, 20, 8, "#867298");
      blockRect(13, 16, 3, 4, "#f7d59a"); blockRect(21, 16, 3, 4, "#f7d59a");
    } else {
      rounded(1, 8, 32, 20, 10, "#315a54");
      rounded(4, 1, 26, 23, 11, "#70b79b");
      rounded(8, 5, 18, 11, 5, "#96d0a8");
      blockRect(11, 15, 3, 5, "#223949"); blockRect(22, 15, 3, 5, "#223949");
      blockRect(5, 24, 8, 4, "#345b55"); blockRect(23, 24, 8, 4, "#345b55");
    }
    ctx.restore();
  }
  function drawGuardian() {
    var boss = level.guardian;
    if (boss.hp <= 0) return;
    if (boss.invulnerable > 0 && Math.floor(state.elapsed * 15) % 2) return;
    ctx.save(); ctx.translate(boss.x, boss.y);
    rounded(2, 20, 51, 37, 15, "#32455c");
    rounded(8, 9, 40, 38, 16, "#617589");
    rounded(13, 6, 30, 27, 13, "#8c9eb0");
    blockRect(15, 30, 7, 6, "#ffdc88"); blockRect(34, 30, 7, 6, "#ffdc88");
    blockRect(10, 53, 13, 5, "#283b50"); blockRect(34, 53, 13, 5, "#283b50");
    ctx.fillStyle = "#e0b47a";
    ctx.beginPath(); ctx.moveTo(14, 10); ctx.lineTo(7, -6); ctx.lineTo(25, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(41, 10); ctx.lineTo(48, -6); ctx.lineTo(31, 8); ctx.fill();
    ctx.restore();
    for (var heart = 0; heart < boss.hp; heart++) {
      ctx.fillStyle = "#ffd583"; ctx.font = "bold 16px system-ui"; ctx.fillText("◆", boss.x + 16 + heart * 18, boss.y - 12);
    }
  }
  function drawPlayer() {
    var player = state.player;
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 15) % 2) return;
    ctx.save(); ctx.translate(player.x + 14, player.y + 22);
    ctx.scale(player.facing, 1);
    var stride = player.onGround ? Math.sin(state.elapsed * Math.abs(player.vx) / 22) * 4 : 0;
    if (player.shield) {
      ctx.strokeStyle = "rgba(137,241,239,.78)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 23, 32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Backpack, scarf and boots give this original courier a readable silhouette.
    rounded(-15, -3, 9, 20, 3, "#a65d49");
    rounded(-11, 12 + stride, 10, 9, 3, "#5a4056");
    rounded(2, 12 - stride, 11, 9, 3, "#5a4056");
    rounded(-10, -7, 22, 24, 6, "#256e78");
    rounded(-8, -5, 18, 18, 5, "#59ac9c");
    rounded(-14, -6, 7, 16, 3, "#efb47c");
    rounded(10, -6, 7, 16, 3, "#efb47c");
    rounded(-9, -25, 22, 19, 7, "#f4c18d");
    rounded(-11, -29, 25, 9, 4, "#dd795b");
    rounded(2, -27, 18, 5, 2, "#e99565");
    blockRect(6, -18, 3, 5, "#203f4c");
    blockRect(11, -15, 5, 2, "#d68a67");
    blockRect(-9, -6, 23, 4, "#f8d384");
    ctx.fillStyle = "#f8d384"; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-24 - Math.sin(state.elapsed * 9) * 4, 2); ctx.lineTo(-8, 1); ctx.fill();
    ctx.restore();
  }
  function drawGoal() {
    // The gate opens only after the guardian has been defeated.
    blockRect(5125, GROUND - 152, 10, 152, "#dbc592");
    blockRect(5080, GROUND - 156, 97, 11, "#d7b985");
    rounded(5089, GROUND - 145, 78, 144, 35, level.guardian.hp ? "#34455d" : "#79bdb7");
    rounded(5099, GROUND - 135, 58, 124, 25, level.guardian.hp ? "#1e334e" : "#d5eff0");
    if (!level.guardian.hp) {
      ctx.fillStyle = "rgba(255,244,190,.62)";
      ctx.beginPath(); ctx.ellipse(5128, GROUND - 72, 26, 60, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffe19a"; ctx.font = "bold 31px system-ui"; ctx.textAlign = "center";
    ctx.fillText("✦", 5128, GROUND - 91);
  }
  function render() {
    if (!ctx || !state || !level) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, HEIGHT);
    scenery();
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - .5) * state.shake * 20, (Math.random() - .5) * state.shake * 15);
    ctx.translate(-Math.round(state.camera), 0);
    drawGround(); drawDecor(); drawBlocksAndCoins();
    for (var enemy of level.enemies) drawEnemy(enemy);
    drawGuardian(); drawGoal(); drawPlayer();
    for (var particle of state.particles) {
      ctx.globalAlpha = clamp(particle.life * 1.7, 0, 1);
      blockRect(particle.x, particle.y, particle.size, particle.size, particle.color);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    var shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    shade.addColorStop(0, "rgba(15,38,57,.05)"); shade.addColorStop(.75, "rgba(15,38,57,0)"); shade.addColorStop(1, "rgba(15,38,57,.16)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, viewportWidth, HEIGHT);
  }
  function loop(now) {
    if (!active) return;
    var dt = last ? clamp((now - last) / 1000, 0, .04) : 0;
    last = now;
    if (state.phase === "running") step(dt);
    else state.elapsed += Math.min(dt, .02);
    for (var block of level.blocks) block.bump = Math.max(0, block.bump - dt);
    render(); hud();
    frame = requestAnimationFrame(loop);
  }
  function start() {
    if (state.phase === "paused") { state.phase = "running"; hideOverlay(); last = 0; return; }
    level = makeLevel(); state = freshState(); state.muted = root.dataset.muted === "true";
    state.phase = "running"; controls = {}; hideOverlay(); last = 0;
    sound("checkpoint"); hud();
  }
  function pause() {
    if (state.phase === "paused") { start(); return; }
    if (state.phase !== "running") return;
    state.phase = "paused"; controls = {};
    overlay("pauseTitle", "pauseText", "resume"); hud();
  }
  function resize() {
    if (!canvas || !ctx) return;
    var stage = root.querySelector(".super-stage");
    viewportWidth = clamp(Math.round(HEIGHT * stage.clientWidth / stage.clientHeight), 460, 1050);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewportWidth * pixelRatio;
    canvas.height = HEIGHT * pixelRatio;
    ctx.imageSmoothingEnabled = false;
    if (state) state.camera = clamp(state.player.x - viewportWidth * .3, 0, WORLD - viewportWidth);
    render();
  }
  function keyDown(event) {
    if (!active || /INPUT|TEXTAREA|SELECT/.test((event.target && event.target.tagName) || "")) return;
    var code = event.code;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space", "ShiftLeft", "ShiftRight", "KeyP", "KeyM"].includes(code)) return;
    event.preventDefault();
    if (code === "ArrowLeft" || code === "KeyA") controls.left = true;
    if (code === "ArrowRight" || code === "KeyD") controls.right = true;
    if (code === "ShiftLeft" || code === "ShiftRight") controls.run = true;
    if ((code === "Space" || code === "ArrowUp" || code === "KeyW") && !event.repeat && state.phase === "running") {
      controls.jump = true; state.player.jumpBuffer = .14;
    }
    if (code === "KeyP" && !event.repeat) pause();
    if (code === "KeyM" && !event.repeat) toggleSound();
  }
  function keyUp(event) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") controls.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") controls.right = false;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") controls.run = false;
    if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") controls.jump = false;
  }
  function toggleSound() {
    state.muted = !state.muted; root.dataset.muted = String(state.muted);
    if (!state.muted) sound("coin"); hud();
  }
  function bind() {
    root.querySelector("#super-overlay button").addEventListener("click", start);
    root.querySelector("#super-restart").addEventListener("click", start);
    root.querySelector("#super-pause").addEventListener("click", pause);
    root.querySelector("#super-sound").addEventListener("click", toggleSound);
    root.querySelector("#super-fullscreen").addEventListener("click", function () {
      var game = root.querySelector(".super-game");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (game.requestFullscreen) game.requestFullscreen();
    });
    root.querySelectorAll("[data-super-control]").forEach(function (button) {
      var action = button.dataset.superControl;
      button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        if (state.phase !== "running") return;
        controls[action] = true;
        if (action === "jump") state.player.jumpBuffer = .14;
        button.classList.add("is-active");
        if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
        button.addEventListener(type, function () { controls[action] = false; button.classList.remove("is-active"); });
      });
    });
    keyDownHandler = keyDown; keyUpHandler = keyUp;
    visibilityHandler = function () { if (document.hidden) pause(); };
    window.addEventListener("keydown", keyDownHandler);
    window.addEventListener("keyup", keyUpHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
  }
  function init(container) {
    deactivate(); root = container; active = true; root.dataset.muted = "false";
    root.innerHTML = '<section class="super-game"><header class="super-hero"><div><p class="super-eyebrow">' + t("eyebrow") + '</p><h2>' + t("headline") + '</h2><p class="super-subtitle">' + t("subtitle") + '</p></div><span class="super-local">' + t("local") + '</span></header>' +
      '<div class="super-stage"><canvas id="super-canvas" role="img" aria-label="' + t("canvasLabel") + '"></canvas>' +
      '<div class="super-hud"><div><span>' + t("score") + '</span><strong id="super-score">0</strong></div><div><span>' + t("coins") + '</span><strong id="super-coins">00</strong></div><div><span>' + t("time") + '</span><strong id="super-timer">180</strong></div><div><span>' + t("hearts") + '</span><strong id="super-hearts">♥♥♥</strong></div><div id="super-shield" class="super-shield" hidden>✧ ' + t("shield") + '</div></div>' +
      '<div class="super-stage-footer"><span id="super-world"></span><div id="super-progress" class="super-progress"><span></span></div><span>01 / 01</span></div>' +
      '<div id="super-toast" class="super-toast" role="status" aria-live="polite"></div>' +
      '<div id="super-overlay" class="super-overlay"><div class="super-overlay-card"><div class="super-overlay-icon">✦</div><small>' + t("island") + '</small><h3></h3><p></p><button type="button" class="super-primary"></button></div></div></div>' +
      '<div class="super-toolbar"><div class="super-toolbar-left"><span class="super-best">' + t("best") + ' <strong id="super-best">0</strong></span><span class="super-legend">' + t("legend") + '</span></div><div class="super-toolbar-right"><button id="super-sound" type="button"></button><button id="super-pause" type="button">' + t("pause") + '</button><button id="super-restart" type="button">' + t("retry") + '</button><button id="super-fullscreen" type="button">' + t("fullscreen") + '</button></div></div>' +
      '<div class="super-controls"><div><button type="button" data-super-control="left" aria-label="' + t("left") + '">◀</button><button type="button" data-super-control="right" aria-label="' + t("right") + '">▶</button></div><div><button type="button" data-super-control="run">' + t("run") + '</button><button type="button" data-super-control="jump">' + t("jump") + '</button></div></div>' +
      '<p class="super-help">' + t("keyboard") + '</p></section>';
    canvas = root.querySelector("#super-canvas"); ctx = canvas.getContext("2d");
    level = makeLevel(); state = freshState(); resize(); bind(); hud();
    overlay("readyTitle", "readyText", "start");
    resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(root.querySelector(".super-stage"));
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(loop);
  }
  function deactivate() {
    active = false;
    if (frame) cancelAnimationFrame(frame); frame = 0; last = 0;
    if (resizeObserver) resizeObserver.disconnect(); resizeObserver = null;
    if (keyDownHandler) window.removeEventListener("keydown", keyDownHandler);
    if (keyUpHandler) window.removeEventListener("keyup", keyUpHandler);
    if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
    window.removeEventListener("resize", resize);
    if (audioContext) { audioContext.close(); audioContext = null; }
    root = null; canvas = null; ctx = null; controls = {};
  }
  return { init: init, deactivate: deactivate, _test: { makeLevel: makeLevel, overlap: overlap, onGroundAt: onGroundAt,
    zoneFor: zoneFor, clamp: clamp, groundY: GROUND, worldWidth: WORLD } };
})();
