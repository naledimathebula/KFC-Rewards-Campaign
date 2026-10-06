// ============================================================
// BUCKET RUN — script.js
//
// A 3D "flick the chicken into the bucket" game built with Three.js.
//   - Crates of wings sit on a table (3D boxes)
//   - Buckets slide along a conveyor belt (looping along the X axis)
//   - Each player has a retro joystick: pull back to aim + set power,
//     release to throw. The chicken piece (a billboarded SPRITE, drawn
//     on a canvas at runtime) arcs through 3D space under gravity.
//   - Land 5 pieces in a bucket before it slides off to win a voucher.
// ============================================================

// ---------------------------------------------------------------
// STEP 1: Scene, camera, renderer
// ---------------------------------------------------------------
const container = document.getElementById('sceneContainer');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x141414, 10, 26);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.2, 7.5);
camera.lookAt(0, 0.5, -3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------
// STEP 2: Lighting
// ---------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xfff2e0, 0.9);
keyLight.position.set(3, 8, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xff4d4d, 0.4);
rimLight.position.set(-4, 3, -6);
scene.add(rimLight);

// ---------------------------------------------------------------
// STEP 3: Table surface
// ---------------------------------------------------------------
const tableGeo = new THREE.PlaneGeometry(16, 20);
const tableMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.85 });
const table = new THREE.Mesh(tableGeo, tableMat);
table.rotation.x = -Math.PI / 2;
table.position.set(0, 0, -4);
scene.add(table);

// ---------------------------------------------------------------
// STEP 4: Conveyor belt (receding into the distance)
// ---------------------------------------------------------------
const CONVEYOR_Z = -7;
const beltGeo = new THREE.BoxGeometry(11, 0.3, 1.6);
const beltMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.2 });
const belt = new THREE.Mesh(beltGeo, beltMat);
belt.position.set(0, 0.15, CONVEYOR_Z);
scene.add(belt);

// side rails for the conveyor, in KFC red
[-0.95, 0.95].forEach((zOff) => {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(11.2, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe4142b })
  );
  rail.position.set(0, 0.34, CONVEYOR_Z + zOff);
  scene.add(rail);
});

// ---------------------------------------------------------------
// STEP 5: Canvas-drawn SPRITE textures (chicken piece + bucket label)
// Drawing on a 2D canvas at runtime gives us a "sprite" look instead
// of a plain untextured shape, per the brief.
// ---------------------------------------------------------------
function makeChickenTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  // drumstick body
  ctx.fillStyle = '#c97a2b';
  ctx.beginPath();
  ctx.ellipse(34, 30, 20, 15, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // crispy texture speckles
  ctx.fillStyle = '#7a4414';
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 16;
    ctx.beginPath();
    ctx.arc(34 + Math.cos(a) * r * 1.1, 30 + Math.sin(a) * r * 0.8, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // highlight
  ctx.fillStyle = 'rgba(255,220,160,0.5)';
  ctx.beginPath();
  ctx.ellipse(28, 22, 7, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // bone
  ctx.fillStyle = '#f1e3c6';
  ctx.fillRect(44, 42, 6, 16);
  ctx.beginPath();
  ctx.arc(47, 58, 5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const chickenTexture = makeChickenTexture();

function makeLabelTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = bg;
  roundRect(ctx, 4, 4, 120, 56, 14);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
// Bucket label: brand name on top, fill count below — this is plain text
// (not a reproduction of the official stylized logo artwork), satisfying
// "buckets must have the KFC brand name" without copying trademarked IP.
function makeBucketLabelTexture(fill) {
  const c = document.createElement('canvas');
  c.width = 180; c.height = 90;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 180, 90);
  roundRect(ctx, 4, 4, 172, 82, 16);
  ctx.fillStyle = '#111111';
  ctx.fill();
  ctx.strokeStyle = '#e4142b';
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, 172, 82, 16);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e4142b';
  ctx.font = '900 26px Arial';
  ctx.fillText('KFC', 90, 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`${fill}/${BUCKET_FILL_TARGET}`, 90, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------
// STEP 6: Crates (one per player) + Buckets (on the conveyor)
// ---------------------------------------------------------------
function makeCrate(x) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 })
  );
  box.position.y = 0.35;
  group.add(box);
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xe4142b })
  );
  lip.position.y = 0.72;
  group.add(lip);
  group.position.set(x, 0, 3.3);
  scene.add(group);
  return group;
}
const p1Crate = makeCrate(-2.4);
const p2Crate = makeCrate(2.4);

const BUCKET_COUNT = 4;
const BUCKET_FILL_TARGET = 5;
const BUCKET_RADIUS = 0.65;
const CATCH_WINDOW = 0.6; // how far around the belt's z-plane we keep checking for a catch
const buckets = [];

function makeBucket(startX) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 0.75, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe4142b, roughness: 0.6, side: THREE.DoubleSide })
  );
  body.position.y = 0.55;
  group.add(body);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.04, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.92;
  group.add(rim);

  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeBucketLabelTexture(0),
    transparent: true
  }));
  labelSprite.scale.set(1.1, 0.55, 1);
  labelSprite.position.y = 1.55;
  group.add(labelSprite);

  group.position.set(startX, 0, CONVEYOR_Z);
  group.userData = { fill: 0, label: labelSprite, lastOwner: null, speed: 0.55 + Math.random() * 0.25 };
  scene.add(group);
  return group;
}
for (let i = 0; i < BUCKET_COUNT; i++) {
  buckets.push(makeBucket(-6 + i * 4));
}
function updateBucketLabel(bucket) {
  bucket.userData.label.material.map = makeBucketLabelTexture(bucket.userData.fill);
  bucket.userData.label.material.needsUpdate = true;
}

// ---------------------------------------------------------------
// STEP 7: Joystick controls (reused 80s-style joystick visual)
// Dragging the ball sets aim + power; releasing fires a throw.
// ---------------------------------------------------------------
class Joystick {
  constructor(baseEl, onThrow) {
    this.base = baseEl;
    this.ball = baseEl.querySelector('.joy-ball');
    this.onThrow = onThrow;
    this.dragging = false;
    this.vec = { x: 0, y: 0 };
    this.maxDist = 34;

    this.base.addEventListener('pointerdown', (e) => this.start(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', () => this.end());
  }
  start(e) {
    if (this.base.classList.contains('depleted')) return;
    this.dragging = true;
    this.base.classList.add('active'); // triggers the gold hover/active color via CSS
    this.base.setPointerCapture?.(e.pointerId);
  }
  move(e) {
    if (!this.dragging) return;
    const rect = this.base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.min(Math.hypot(dx, dy), this.maxDist);
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    this.ball.style.transform = `translate(${dx}px, ${dy}px)`;
    this.vec = { x: dx / this.maxDist, y: dy / this.maxDist };
  }
  end() {
    if (!this.dragging) return;
    this.dragging = false;
    this.base.classList.remove('active');
    // only throw if pulled back meaningfully (toward the player, positive y)
    const power = Math.hypot(this.vec.x, this.vec.y);
    if (power > 0.35 && this.vec.y > 0.15) {
      this.onThrow({ ...this.vec, power });
    }
    this.ball.style.transform = 'translate(0px, 0px)';
    this.vec = { x: 0, y: 0 };
  }
}

// ---------------------------------------------------------------
// STEP 8: Throwing physics
// ---------------------------------------------------------------
const GRAVITY = 9.2;
const MAX_ATTEMPTS = 10;
const projectiles = [];
let gameOver = false;

const p1AttemptsLabel = document.getElementById('p1Attempts');
const p2AttemptsLabel = document.getElementById('p2Attempts');
const p1ScoreBox = document.querySelector('.score.p1');
const p2ScoreBox = document.querySelector('.score.p2');
const p1StickBase = document.getElementById('p1Stick').querySelector('.joy-base');
const p2StickBase = document.getElementById('p2Stick').querySelector('.joy-base');
let p1Attempts = MAX_ATTEMPTS;
let p2Attempts = MAX_ATTEMPTS;

function spendAttempt(owner) {
  if (owner === 'p1') {
    p1Attempts--;
    p1AttemptsLabel.textContent = `${Math.max(p1Attempts, 0)} throws left`;
    if (p1Attempts <= 0) { p1ScoreBox.classList.add('depleted'); p1StickBase.classList.add('depleted'); }
  } else {
    p2Attempts--;
    p2AttemptsLabel.textContent = `${Math.max(p2Attempts, 0)} throws left`;
    if (p2Attempts <= 0) { p2ScoreBox.classList.add('depleted'); p2StickBase.classList.add('depleted'); }
  }
  // if both players are out of attempts and nobody has won, end the round
  if (p1Attempts <= 0 && p2Attempts <= 0 && !gameOver) {
    gameOver = true;
    document.getElementById('outOfAttemptsModal').classList.remove('hidden');
  }
}

function throwChicken(owner, crate, aim) {
  if (gameOver) return;
  const attemptsLeft = owner === 'p1' ? p1Attempts : p2Attempts;
  if (attemptsLeft <= 0) return;
  spendAttempt(owner);
  const tex = chickenTexture;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(0.45, 0.45, 1);
  sprite.position.set(crate.position.x, 0.75, crate.position.z);
  scene.add(sprite);

  // joystick pulled BACK (positive y) + left/right (x) sets aim & power
  //
  // IMPORTANT: vz is intentionally close to constant (not power-scaled much).
  // The old version tied forward speed AND height both to power, which meant
  // low power fell to the ground before ever reaching the belt, and high
  // power arrived while still way too high in the air to drop into a bucket
  // — there was no power level that actually worked. Keeping forward speed
  // steady means flight TIME to the belt is predictable, so we can tune vy
  // (height) to reliably land at bucket-rim height no matter how hard you pull.
  const power = Math.min(aim.power, 1);
  const vz = -(7.0 + power * 0.8);          // forward speed toward the conveyor (nearly constant)
  const vx = aim.x * 4.0;                   // left/right aim
  const vy = 6.0 + power * 0.6;             // arc height — tuned so it lands near rim height at t≈1.37s

  projectiles.push({
    sprite,
    vel: { x: vx, y: vy, z: vz },
    owner,
    born: performance.now()
  });
}

const p1Stick = new Joystick(document.getElementById('p1Stick').querySelector('.joy-base'),
  (aim) => throwChicken('p1', p1Crate, aim));
const p2Stick = new Joystick(document.getElementById('p2Stick').querySelector('.joy-base'),
  (aim) => throwChicken('p2', p2Crate, aim));

// ---------------------------------------------------------------
// STEP 9: Win modal + voucher code
// ---------------------------------------------------------------
const winModal = document.getElementById('winModal');
const winnerName = document.getElementById('winnerName');
const voucherCode = document.getElementById('voucherCode');
const p1FillLabel = document.getElementById('p1Fill');
const p2FillLabel = document.getElementById('p2Fill');
const p1RoundsLabel = document.getElementById('p1Rounds');
const p2RoundsLabel = document.getElementById('p2Rounds');
const roundToast = document.getElementById('roundToast');
const roundToastText = document.getElementById('roundToastText');
let p1Total = 0, p2Total = 0;

// A player must win this many ROUNDS (bucket fills) to win the match
const ROUNDS_TO_WIN = 2;
let p1Rounds = 0, p2Rounds = 0;

function updateRoundsHUD() {
  p1RoundsLabel.textContent = `Rounds ${p1Rounds}/${ROUNDS_TO_WIN}`;
  p2RoundsLabel.textContent = `Rounds ${p2Rounds}/${ROUNDS_TO_WIN}`;
}

// ---------------------------------------------------------------
// Crunch sound — synthesized with the Web Audio API (no audio file
// needed): a burst of filtered noise plus a handful of sharp little
// "pop/crack" clicks layered on top, to sell a crispy-chicken crunch.
// ---------------------------------------------------------------
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playCrunchSound() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  // the "crunch" bed: short burst of band-passed white noise
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1800;
  bandpass.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  noise.connect(bandpass).connect(noiseGain).connect(ctx.destination);
  noise.start(now);

  // a handful of sharp little "cracks" on top, randomly spaced
  for (let i = 0; i < 6; i++) {
    const t = now + Math.random() * 0.3;
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 800 + Math.random() * 1400;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    click.connect(clickGain).connect(ctx.destination);
    click.start(t);
    click.stop(t + 0.05);
  }
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Called the moment a bucket is filled to target. This is a ROUND win —
// it takes two of these to win the overall match (per the brief).
function handleBucketFilled(owner) {
  playCrunchSound();
  gameOver = true; // briefly pause play while we show the toast / slip

  if (owner === 'p1') p1Rounds++; else p2Rounds++;
  updateRoundsHUD();

  const roundsSoFar = owner === 'p1' ? p1Rounds : p2Rounds;
  const playerLabel = owner === 'p1' ? 'Player 1' : 'Player 2';

  if (roundsSoFar >= ROUNDS_TO_WIN) {
    // MATCH WIN — show the printed voucher slip
    showWinSlip(owner);
  } else {
    // ROUND WIN — quick toast, then automatically start the next round
    roundToastText.textContent = `${playerLabel} wins Round ${roundsSoFar}! Next round starting...`;
    roundToast.classList.remove('hidden');
    requestAnimationFrame(() => roundToast.classList.add('show'));
    setTimeout(() => {
      roundToast.classList.remove('show');
      setTimeout(() => roundToast.classList.add('hidden'), 350);
      startNextRound();
    }, 1700);
  }
}

function showWinSlip(owner) {
  winnerName.textContent = owner === 'p1' ? 'Player 1' : 'Player 2';
  voucherCode.textContent = `CODE: ${randomCode()}`;
  winModal.classList.remove('hidden');
  const slip = winModal.querySelector('.receipt-slip');
  slip.classList.remove('animate-in');
  void slip.offsetWidth; // force reflow so the animation can replay
  slip.classList.add('animate-in');
}

// Clears the board/attempts for a fresh round WITHOUT resetting round wins
function startNextRound() {
  gameOver = false;
  p1Total = 0; p2Total = 0;
  p1FillLabel.textContent = '0 / 5';
  p2FillLabel.textContent = '0 / 5';
  p1Attempts = MAX_ATTEMPTS;
  p2Attempts = MAX_ATTEMPTS;
  p1AttemptsLabel.textContent = `${MAX_ATTEMPTS} throws left`;
  p2AttemptsLabel.textContent = `${MAX_ATTEMPTS} throws left`;
  p1ScoreBox.classList.remove('depleted');
  p2ScoreBox.classList.remove('depleted');
  p1StickBase.classList.remove('depleted');
  p2StickBase.classList.remove('depleted');
  buckets.forEach((b) => { b.userData.fill = 0; updateBucketLabel(b); });
  projectiles.forEach((p) => scene.remove(p.sprite));
  projectiles.length = 0;
}

// Full reset: clears round wins too, used after a match is won/restarted
function startNewMatch() {
  p1Rounds = 0; p2Rounds = 0;
  updateRoundsHUD();
  startNextRound();
}

document.getElementById('playAgainBtn').addEventListener('click', () => {
  winModal.classList.add('hidden');
  startNewMatch();
});
document.getElementById('tryAgainBtn').addEventListener('click', () => {
  document.getElementById('outOfAttemptsModal').classList.add('hidden');
  startNextRound(); // out of throws just restarts the CURRENT round, not the match
});

// ---------------------------------------------------------------
// STEP 10: Theme toggle (dark / light mode)
// ---------------------------------------------------------------
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// ---------------------------------------------------------------
// STEP 11: Main animation loop
//   - scroll the conveyor + slide buckets along it, looping
//   - integrate projectile physics (gravity) each frame
//   - check for a bucket catch or a miss
// ---------------------------------------------------------------
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  // slide buckets along the conveyor (loop around when off-screen)
  buckets.forEach((b) => {
    b.position.x -= b.userData.speed * dt * 2.2;
    if (b.position.x < -6.5) b.position.x += BUCKET_COUNT * 4;
    b.rotation.y += dt * 0.2; // gentle spin for visual interest
  });

  // integrate each active throw
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    p.vel.y -= GRAVITY * dt;
    p.sprite.position.x += p.vel.x * dt;
    p.sprite.position.y += p.vel.y * dt;
    p.sprite.position.z += p.vel.z * dt;
    p.sprite.material.rotation += dt * 6; // tumbling flip

    let remove = false;

    // Check for a catch across a WINDOW around the belt's z-plane, not just
    // the single exact frame it crosses — at high frame rates/variable dt a
    // one-frame check can skip right over the belt and always miss, even
    // when the throw was otherwise lined up correctly.
    if (p.sprite.position.z <= CONVEYOR_Z + CATCH_WINDOW) {
      const landedY = p.sprite.position.y;
      let caught = null;
      if (landedY > 0.1 && landedY < 1.6) {
        for (const b of buckets) {
          if (Math.abs(p.sprite.position.x - b.position.x) < BUCKET_RADIUS) {
            caught = b;
            break;
          }
        }
      }
      if (caught) {
        caught.userData.fill++;
        caught.userData.lastOwner = p.owner;
        updateBucketLabel(caught);
        if (p.owner === 'p1') { p1Total++; p1FillLabel.textContent = `${p1Total} / 5`; }
        else { p2Total++; p2FillLabel.textContent = `${p2Total} / 5`; }

        // little "catch" bounce
        caught.scale.set(1.25, 1.25, 1.25);
        setTimeout(() => caught.scale.set(1, 1, 1), 150);

        if (caught.userData.fill >= BUCKET_FILL_TARGET) {
          handleBucketFilled(p.owner);
        }
        remove = true;
      } else if (p.sprite.position.z < CONVEYOR_Z - CATCH_WINDOW) {
        remove = true; // passed all the way through the window without a catch — miss
      }
    }

    // fell below the table = miss, clean it up
    if (p.sprite.position.y < -1.5) {
      remove = true;
    }

    if (remove) {
      scene.remove(p.sprite);
      projectiles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();