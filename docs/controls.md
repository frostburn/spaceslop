# Controls and weapons

From the main menu, choose a sector and select **Open briefing**. Pick a pilot and select **Launch**. Use **Menu** to leave the run and choose another sector.

Tap or click the playfield to send the drone to that point. It parks and fires automatically. Drag from the same touch to steer the ship while the drone covers its lane. On a keyboard use WASD or the arrow keys. Guns fire automatically. Use Pulse or Space to clear incoming fire, and Pause or Escape to pause.

Boss tips in the HUD identify the current target and attack cues. Line up the ship or park the drone on a marked weak point, and move clear of amber aim warnings after they lock.

In Vite dev mode, expand **Dev launch shortcuts** to skip to the selected mission’s boss approach, first Wormhole supply drop or another encounter offered in its briefing. Expand **Test loadout** to pre-equip a wing weapon or start with Towline. The test loadout is also available with `?testLoadout=1`.

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
