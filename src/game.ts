export const WIDTH = 9;
export const HEIGHT = 16;
export const STEP = 1 / 60;
export const BOSS_DEPTH = -12;
export const BOSS_Y = 4.2;
export const BOSS_HP = 30;
export const TRANSITION_TIME = 1.25;

type Phase = 'stage' | 'approach' | 'boss' | 'won' | 'lost';
type Point = { x: number; y: number };
type Shot = Point & { z: number; vx: number; vy: number; vz: number; targetsBoss?: boolean };
type Enemy = Point & { lane: number; age: number; fire: number; hp: number };

const stageWaves = [
  { time: 0.6, lanes: [-2.6, 0, 2.6] },
  { time: 3.6, lanes: [-2, 2] },
  { time: 6.6, lanes: [-3, 0, 3] },
  { time: 9.6, lanes: [-1.3, 1.3] },
];

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const near = (a: Point, b: Point, radius: number) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < radius ** 2;

export class Flight {
  phase: Phase = 'stage';
  time = 0;
  player = { x: 0, y: -5.3 };
  hull = 4;
  invulnerable = 0;
  charges = 2;
  score = 0;
  bossHealth = BOSS_HP;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  threats: Shot[] = [];
  markers: Point[] = [];
  pulseFlash = 0;
  private nextWave = 0;
  private cooldown = 0;
  private volley = 0;

  move(x: number, y: number) {
    this.player.x = clamp(this.player.x + x, -3.95, 3.95);
    this.player.y = clamp(this.player.y + y, -7.1, 6.6);
  }

  pulse() {
    if (this.charges === 0 || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    this.charges--;
    this.pulseFlash = 0.3;
    this.threats = [];
    if (this.phase === 'stage') {
      this.score += this.enemies.length * 100;
      this.enemies = [];
    } else {
      this.damageBoss(6);
    }
  }

  step(dt: number) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt);
    if (this.phase === 'approach') {
      if (this.time >= TRANSITION_TIME) this.enter('boss');
      return;
    }

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown += 0.19;
      this.fire();
    }

    const boss = this.phase === 'boss';
    if (boss) this.stepBoss();
    else this.stepStage(dt);

    this.shots = this.shots.filter((shot) => {
      const previousY = shot.y;
      this.advance(shot, dt);
      if (boss) {
        if (shot.z > BOSS_DEPTH) return true;
        if (shot.targetsBoss) this.damageBoss(1);
        return false;
      }
      const enemy = this.enemies.find((target) => target.hp > 0 &&
        Math.abs(shot.x - target.x) < 0.52 &&
        shot.y >= target.y - 0.46 && previousY <= target.y + 0.46);
      if (!enemy) return shot.y < 9;
      enemy.hp--;
      if (enemy.hp === 0) this.score += 100;
      return false;
    });
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.y > -9);

    this.threats = this.threats.filter((shot) => {
      this.advance(shot, dt);
      if (boss) {
        if (shot.z < 0) return true;
        if (near(shot, this.player, 0.58)) this.hit();
        return false;
      }
      if (near(shot, this.player, 0.44)) {
        this.hit();
        return false;
      }
      return Math.abs(shot.x) < 5 && Math.abs(shot.y) < 9;
    });

    if (this.phase === 'stage' && this.time >= 14) this.enter('approach');
  }

  private stepStage(dt: number) {
    const wave = stageWaves[this.nextWave];
    if (wave && this.time >= wave.time) {
      this.nextWave++;
      this.enemies.push(...wave.lanes.map((lane, index) =>
        ({ x: lane, y: 8.6, lane, age: 0, fire: 1.1 + index * 0.28, hp: 2 })));
    }

    for (const enemy of this.enemies) {
      enemy.age += dt;
      enemy.y -= 2.25 * dt;
      enemy.x = enemy.lane + Math.sin(enemy.age * 1.55) * 0.46;
      if (enemy.age >= enemy.fire) {
        enemy.fire += 2.4;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const scale = 5.7 / (Math.hypot(dx, dy) || 1);
        this.threats.push({ x: enemy.x, y: enemy.y, z: 0, vx: dx * scale, vy: dy * scale, vz: 0 });
      }
      if (near(enemy, this.player, 0.68)) {
        enemy.hp = 0;
        this.hit();
      }
    }
  }

  private stepBoss() {
    const elapsed = this.time % 2;
    const volley = Math.floor(this.time / 2);
    if (elapsed >= 0.45 && this.markers.length === 0 && elapsed < 1.18) {
      const { x, y } = this.player;
      this.markers = [-1.35, 0, 1.35].map((offset) => ({
        x: clamp(x, -2.6, 2.6) + (this.volley % 2 === 0 ? offset : 0),
        y: clamp(y, -5.9, 5.25) + (this.volley % 2 === 0 ? 0 : offset),
      }));
    }
    if (elapsed >= 1.18 && this.markers.length && this.volley === volley) {
      const duration = 0.48;
      this.threats.push(...this.markers.map((target) => ({
        x: 0, y: BOSS_Y, z: BOSS_DEPTH,
        vx: target.x / duration, vy: (target.y - BOSS_Y) / duration, vz: -BOSS_DEPTH / duration,
      })));
      this.volley++;
    }
    if (elapsed >= 1.68) this.markers = [];
  }

  private fire() {
    const { x, y } = this.player;
    if (this.phase === 'stage') {
      this.shots.push({ x, y: y + 0.45, z: 0, vx: 0, vy: 15, vz: 0 });
    } else {
      const duration = 0.38;
      const targetsBoss = Math.abs(x) < 1.65;
      this.shots.push({ x, y, z: 0, vx: targetsBoss ? -x / duration : 0,
        vy: targetsBoss ? (BOSS_Y - y) / duration : 0, vz: BOSS_DEPTH / duration, targetsBoss });
    }
  }

  private advance(shot: Shot, dt: number) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.z += shot.vz * dt;
  }

  private damageBoss(damage: number) {
    if (this.phase !== 'boss') return;
    this.bossHealth = Math.max(0, this.bossHealth - damage);
    if (this.bossHealth === 0) {
      this.score += 1000;
      this.enter('won');
    }
  }

  private hit() {
    if (this.invulnerable > 0 || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    this.invulnerable = 1.05;
    this.hull--;
    if (this.hull === 0) this.enter('lost');
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.time = 0;
    if (phase === 'approach') {
      this.shots = [];
      this.threats = [];
      this.enemies = [];
    }
    if (phase === 'boss') this.cooldown = 0;
  }
}
