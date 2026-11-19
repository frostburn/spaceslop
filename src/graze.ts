type Point = { x: number; y: number };

export const GRAZE_CAPACITY = 4;
const pointsPerGraze = 25;

export class GrazeBank {
  count = 0;
  charge = 0;
  banked = 0;
  lastPayout = 0;
  payoutTime = 0;
  spark?: Point;

  pass(player: Point, shot: Point) {
    this.count++;
    if (this.charge === GRAZE_CAPACITY) return;
    this.charge++;
    // Put the spark on the side the shot passed, outside the fighter's center marker.
    const dx = shot.x - player.x, dy = shot.y - player.y;
    const scale = .48 / (Math.hypot(dx, dy) || 1);
    this.spark = { x: player.x + dx * scale, y: player.y + dy * scale };
  }

  bank() {
    if (this.charge === 0) return 0;
    this.lastPayout = this.charge * pointsPerGraze;
    this.banked += this.lastPayout;
    this.payoutTime = .9;
    this.charge = 0;
    return this.lastPayout;
  }

  hit() {
    this.charge = 0;
    this.spark = undefined;
  }
}
