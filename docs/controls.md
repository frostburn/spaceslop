# Controls and weapons

From the main menu, choose a sector and select **Open briefing**. Pick a pilot and select **Launch**. Use **Menu** to leave the run and choose another sector.

Tap or click the playfield to send the drone to that point. It parks and fires automatically. Drag to steer the ship while the drone holds its lane. Lift to stop. On a keyboard use WASD or the arrow keys. Guns fire automatically. Space fires Pulse from the playfield and activates a focused button. Escape pauses.

Boss tips in the HUD identify the current target and attack cues. Line up the ship or park the drone on a marked weak point, and move clear of amber aim warnings after they lock.

Every pilot can graze live enemy shots. Let one pass just outside the fighter and a brass lamp lights beside the score. Each of the four lamps holds 25 points. Destroy a stage enemy or take a boss through a quarter of its health to bank the lit lamps. A hull hit discharges them. Each shot can count once, and Vex earns one extra Pulse on the fourth graze of the sortie.

The Lantern Ray also pays 25 points for each of the first two seekers shot down per quarter of its health.

The results screen shows your total score, grazes and banked bonus. A full clear with the standard starting equipment can set a personal best on this device. Campaign and Free Flight share a sector record for the same difficulty. Regular, Bullet Hell and Hardcore each have their own records. The briefing shows the target for your next run. Dev shortcuts and pre-equipped weapons give practice scores.

In the Bullet Hell variants, use the fighter's center ring to judge gaps in the projectile streams. Boss targeting circles appear for the Sunspot Regulator's aimed plasma. When the Command Saucer and Gantry Chief seed the screen with hollow pellets, move into an open pocket or lane. Pellets stay where they land and can hit once fully filled, until they start to fade.

Completing the regular campaign unlocks **Bullet Hell**. Fly all thirteen missions with denser enemy fire and a faster fighter with orange exhaust. Defeat **Fons Inversus Rex** in the Return Channel to unlock **Bullet Hell Hardcore**. Hardcore uses red exhaust and ends with **Fons Inversus Invictus**. The first hit ends the run and sends you back to Broodlock. Each surplus weapon pickup with Brass clears the hostile bullets on screen. Both modes also accept their names as case-insensitive unlock codes under **Settings**.

In Vite dev mode, **Free Flight** briefings let you select Regular, Bullet Hell or Bullet Hell Hardcore at any time. **Launch at Fons** in the Return Channel briefing uses the selected difficulty to choose the finale. Practice wins and losses leave campaign and challenge progress intact. Sectors with authored Bullet Hell patterns use them in both challenge difficulties. Expand **Test loadout** to pre-equip a wing weapon or start with Towline. The test loadout is also available with `?testLoadout=1`.

The drone starts with **Sentry** fire. **Towline** adds a pulsing arc between the ship and the parked drone. Drag the ship to sweep the arc through enemies or across a boss weak point. Each pulse deals 3 damage per target during a 0.3-second window.

Clearing a formation with a reward drops one pickup at the last kill. Pulse counts toward the clear. Escapes and rams forfeit the reward. Fly through the pickup to collect it.

In The Return Channel, two random weapon pickups appear before every boss. After every three bosses, a repair capsule restores one hull, up to four hull or five if Brass has triggered Reinforcement.

1. A new weapon equips on the side where the ship catches it. The opposite wing takes it if that wing is the only empty slot. With both slots occupied, the pickup replaces the weapon on the collection side.
2. A matching pickup upgrades a Mk I copy to Mk II for 50% more damage. If both wings can take the upgrade, the collection side takes it.
3. Once the equipped copy is Mk II, the next match equips a second Mk I copy on an empty wing. The following match upgrades it to Mk II.
4. Once both wings are occupied and every copy of the matching weapon is Mk II, the next match unlocks Towline for the rest of the sortie.
5. With Towline unlocked, surplus pickups award 250 points. Brass's **Reinforcement** grants +1 hull on the first surplus pickup each sortie, even at full starting hull. Later surplus pickups award 250 points.

- **Homing Cannon** fires weak guided missiles.
- **Standard Cannon** fires straight down its lane.
- **Continuous Laser** builds damage while it stays on one target.
- **Omega Cannon** charges slowly and fires a heavy bolt through multiple enemies.

During boss fights, line a wing up horizontally with the active weak point. Homing missiles steer toward it automatically.

Each gun has its own projectile silhouette and trail: cyan ship darts, mint drone pulses, finned homing missiles, cannon tracers, and gold omega lances. Enemy plasma and hive spores have bright centers and dark rims. Lasers ripple along their length and burn an ablation flame that sheds incandescent sparks at contact. Regular enemies use their projected opaque silhouette; bosses use the active muzzle's animated contact anchor, including recoil. Laser damage produces no extra body-hit bursts. Bullet and other impact effects still appear, including when they hit a target under laser fire. Damage feedback renders over enemy shells and mold.

Ineffective boss laser hits show expanding blue shield ripples at the beam endpoint. Ablation flames and sparks appear only while the beam deals damage.

Wing pickups use metal badges with matching colors and distinct weapon icons, rotating beacons, and a short arrival animation. The homing icon is a fixed crosshair with two shrinking lock-on circles. Muzzle flashes and collection bursts give immediate feedback. These effects use shared geometry and pooled instances, are warmed before launch, and need no new asset files.
