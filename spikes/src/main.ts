// Throwaway spike (PKR-015): one source, built against Phaser 3 and Phaser 4.
// Greybox location + Story Template character on the grid + camera follow + UI/audio probes.
import Phaser from 'phaser';
import harbour from '../../assets/locations/loc_greybox-harbour.json';

const TILE = 64;
const SPEED = 4 * TILE; // GDD §3: 4 tiles/s
const WALK_FPS = 12; // GDD §3
const LAYERS = ['body', 'outfit', 'hair'] as const;
const DIRS = ['up', 'left', 'right', 'down'] as const;
type Dir = (typeof DIRS)[number];
const VEC: Record<Dir, [number, number]> = { up: [0, -1], left: [-1, 0], right: [1, 0], down: [0, 1] };
const GEN = `${import.meta.env.BASE_URL}gen/`;

const held: Dir[] = []; // most recent last; fed by keyboard and the on-screen pad
function press(d: Dir, on: boolean) {
  const i = held.indexOf(d);
  if (i >= 0) held.splice(i, 1);
  if (on) held.push(d);
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number) {
  const c = scene.textures.createCanvas(key, w, h);
  if (!c) throw new Error(`canvas texture ${key}`);
  return c;
}

class Spike extends Phaser.Scene {
  private layers: Phaser.GameObjects.Sprite[] = [];
  private tile: [number, number] = [0, 0];
  private face: Dir = 'down';
  private moving: { dx: number; dy: number; left: number } | null = null;
  private frameMs: number[] = [];
  private loopStamps: number[] = [];
  private sfx?: Phaser.Sound.BaseSound;
  private pivotInfo = '';

  preload() {
    for (const l of LAYERS) {
      this.load.atlas(l, `${GEN}rosa/spr_walk_${l}_rosa.png`, `${GEN}rosa/spr_walk_${l}_rosa.json`);
    }
    this.load.audio('loop', `${GEN}loop.wav`);
  }

  create() {
    const [cols, rows] = harbour.size as [number, number];
    const W = cols * TILE;
    const H = rows * TILE;

    // Ground: two images side by side (real locations are split at 2048 px, Asset Spec §8.2).
    const half = (cols / 2) * TILE;
    for (let part = 0; part < 2; part++) {
      const c = canvasTex(this, `ground${part}`, half, H);
      const g = c.getContext();
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols / 2; tx++) {
          const gx = tx + part * (cols / 2);
          g.fillStyle = ty === rows - 1 ? '#5b7fb5' : (gx + ty) % 2 ? '#7fae6a' : '#78a663';
          g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
      c.refresh();
      this.add.image(part * half, 0, `ground${part}`).setOrigin(0, 0).setDepth(-1e6);
    }

    // Props: one 64 x 96 box per '#' collision cell, y-sorted with the characters by anchor y.
    const pc = canvasTex(this, 'prop', TILE, 96);
    const pg = pc.getContext();
    pg.fillStyle = '#8a5a3a';
    pg.fillRect(0, 0, TILE, 96);
    pg.fillStyle = '#b57c52';
    pg.fillRect(4, 4, TILE - 8, 40);
    pc.refresh();
    const coll = harbour.collision as string[];
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        if (coll[ty]?.[tx] === '#') {
          this.add
            .image(tx * TILE + TILE / 2, (ty + 1) * TILE, 'prop')
            .setOrigin(0.5, 1)
            .setDepth((ty + 1) * TILE);
        }
      }
    }

    // Character: the three Slicer-exported layer atlases, loaded as-is, stacked.
    const start = (harbour.spawns as unknown as Record<string, { tile: [number, number]; facing: Dir }>)['spawn_start'];
    if (!start) throw new Error('spawn_start');
    this.tile = [start.tile[0], start.tile[1]];
    this.face = start.facing;
    LAYERS.forEach((l, i) => {
      for (const d of DIRS) {
        this.anims.create({
          key: `${l}_${d}`,
          frames: this.anims.generateFrameNames(l, { prefix: `walk_${d}_`, start: 0, end: 5, zeroPad: 2 }),
          frameRate: WALK_FPS,
          repeat: -1,
        });
      }
      const s = this.add.sprite(0, 0, l, `walk_${this.face}_02`);
      this.layers.push(s);
      if (i === 0) {
        // Does the engine pick up the atlas's own pivot (0.5, 0.9375) without being told?
        const fr = s.frame as unknown as { customPivot?: boolean };
        this.pivotInfo = `pivot from atlas: ${fr.customPivot ?? false}, origin ${s.originX},${s.originY}`;
      }
      s.setOrigin(0.5, 0.9375); // Asset Spec §2.1
    });
    this.place();

    // Camera: follows the anchor, clamps to the location edges.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    const target = this.layers[0];
    if (!target) throw new Error('layers');
    cam.startFollow(target, true);

    // UI probe (UI Spec §1): a 240 x 135 u layout drawn at 1x and shown at 4x, nearest-neighbour.
    const ui = canvasTex(this, 'ui', 240, 135);
    const ug = ui.getContext();
    ug.fillStyle = '#f8f8f8';
    ug.fillRect(8, 95, 224, 34);
    ug.fillStyle = '#404040';
    ug.fillRect(10, 97, 220, 30);
    ug.fillStyle = '#ffffff';
    ug.fillRect(12, 99, 216, 26);
    ug.fillStyle = '#202020';
    ug.font = '8px monospace';
    ug.textBaseline = 'top';
    ug.fillText('Ciao! 240x135 u, 4x, nearest.', 16, 103);
    ug.fillText('Passo 4 tile/s, 12 fps', 16, 113);
    ui.refresh();
    this.add.image(0, 0, 'ui').setOrigin(0, 0).setScale(4).setScrollFactor(0).setDepth(1e7);

    // Audio probe through the engine's own Sound API: 1 s intro, then a marker looping 1 s.
    this.sfx = this.sound.add('loop');
    this.sfx.addMarker({ name: 'body', start: 1, duration: 1, config: { loop: true } });
    this.sfx.on('looped', () => this.loopStamps.push(performance.now()));
    document.getElementById('aud')?.addEventListener('click', () => {
      const s = this.sfx;
      if (!s) return;
      if (s.isPlaying) {
        s.stop();
        return;
      }
      this.loopStamps = [];
      s.play('body');
    });

    // Input: keyboard and the on-screen pad.
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down' };
    window.addEventListener('keydown', (e) => {
      const d = map[e.key];
      if (d) press(d, true);
    });
    window.addEventListener('keyup', (e) => {
      const d = map[e.key];
      if (d) press(d, false);
    });
    document.querySelectorAll<HTMLButtonElement>('#pad button').forEach((b) => {
      const d = b.dataset['d'] as Dir;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        press(d, true);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => press(d, false));
    });

    (window as unknown as { __spike: unknown }).__spike = this;
    setInterval(() => this.hud(), 500);
  }

  private place(dx = 0, dy = 0) {
    const x = Math.round(this.tile[0] * TILE + TILE / 2 + dx);
    const y = Math.round((this.tile[1] + 1) * TILE + dy); // anchor = feet at the tile's bottom edge
    this.layers.forEach((s, i) => {
      s.setPosition(x, y);
      s.setDepth(y + i * 0.001);
    });
  }

  private blocked(tx: number, ty: number) {
    const [cols, rows] = harbour.size as [number, number];
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
    return (harbour.collision as string[])[ty]?.[tx] === '#';
  }

  override update(_t: number, delta: number) {
    this.frameMs.push(delta);
    const dt = Math.min(delta, 100) / 1000;
    if (!this.moving) {
      const d = held[held.length - 1];
      if (d) {
        this.face = d;
        const [vx, vy] = VEC[d];
        if (!this.blocked(this.tile[0] + vx, this.tile[1] + vy)) this.moving = { dx: vx, dy: vy, left: TILE };
      }
    }
    if (this.moving) {
      const m = this.moving;
      const step = Math.min(SPEED * dt, m.left);
      m.left -= step;
      const done = TILE - m.left;
      this.place(m.dx * done, m.dy * done);
      if (m.left <= 0) {
        this.tile = [this.tile[0] + m.dx, this.tile[1] + m.dy];
        this.moving = null;
        this.place();
      }
    }
    const walking = !!this.moving;
    this.layers.forEach((s, i) => {
      const l = LAYERS[i];
      if (walking) s.anims.play(`${l}_${this.face}`, true);
      else {
        s.anims.stop();
        s.setFrame(`walk_${this.face}_02`);
      }
    });
  }

  private hud() {
    const f = this.frameMs.splice(0);
    if (!f.length) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    const max = Math.max(...f);
    const iv = this.loopStamps.slice(1).map((t, i) => t - (this.loopStamps[i] ?? t));
    const g = this.game;
    const r = g.canvas.getBoundingClientRect();
    const text = [
      `Phaser ${Phaser.VERSION} · ${g.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`,
      `fps ${(1000 / avg).toFixed(1)} · avg ${avg.toFixed(1)} ms · max ${max.toFixed(1)} ms`,
      `canvas ${g.canvas.width}x${g.canvas.height} css ${Math.round(r.width)}x${Math.round(r.height)} dpr ${window.devicePixelRatio}`,
      `tile ${this.tile.join(',')} face ${this.face}`,
      this.pivotInfo,
      `audio loops ${this.loopStamps.length}${iv.length ? ` · interval ${Math.min(...iv).toFixed(0)}-${Math.max(...iv).toFixed(0)} ms` : ''}`,
    ].join('\n');
    const el = document.getElementById('hud');
    if (el) el.textContent = text;
    (window as unknown as { __stats: unknown }).__stats = { avg, max, samples: f.length, text };
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Spike,
});

if ('serviceWorker' in navigator) {
  // The PWA plugin's generated worker lives next to index.html; registered with the spike's own scope.
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    .catch(() => undefined);
}
