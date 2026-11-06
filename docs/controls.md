# Controls and weapons

From the main menu, choose a sector and select **Prepare flight**. Choose a pilot, drone and optional test loadout in the hangar, then launch. Use **Menu** to leave the run and choose another sector.

Tap or click the playfield to send the drone to that point. It parks and fires automatically. Drag from the same touch to steer the ship while the drone covers its lane. On a keyboard use WASD or the arrow keys. Guns fire automatically. Use Pulse or Space to clear incoming fire, and Pause or Escape to pause. In the boss fight, line up horizontally to lock on with the ship. Put the drone on the green target marker (Leviathan’s mouth, or a cannon on the other bosses), and keep the ship clear of amber warning rings. The other bosses switch exposed cannons after each volley.

In Vite dev mode, **Launch at boss** starts the selected level at its normal approach transition with your chosen pilot, drone and test wing loadout. The shortcut is absent from production builds; ordinary **Launch** always starts the scrolling stage.

Choose **Sentry** or **Towline** before launch. With Towline equipped, park the drone and drag the ship to sweep the arc through enemy formations. The arc pulses automatically while the drone is parked. Against the boss, sweep the line across the green target during a pulse.

Enemies can drop wing weapons. Fly through a pickup to equip a pod that flies alongside your ship. An empty slot takes priority, and with both occupied the pickup replaces the pod on the side where you collected it. For testing, expand **Test wing loadout** before launch to equip either wing immediately. The picker is available in Vite dev and on builds opened with `?testLoadout=1`.

- **Homing Cannon** fires weak guided missiles.
- **Standard Cannon** fires straight down its lane.
- **Continuous Laser** builds damage while it stays on one target.
- **Omega Cannon** charges slowly and fires a heavy bolt through multiple enemies.

During boss fights, line a wing up horizontally with the green target. Homing missiles steer toward it automatically.

Each gun has its own projectile silhouette and trail: cyan ship darts, mint drone pulses, finned homing missiles, cannon tracers, and gold omega lances. Enemy plasma and hive spores have bright centers and dark rims. Lasers ripple along their length and burn an ablation flame that sheds incandescent sparks at contact. Regular enemies use their projected opaque silhouette; bosses use the active muzzle's animated contact anchor, including recoil. Laser damage produces no extra body-hit bursts. Bullet and other impact effects still appear, including when they hit a target under laser fire. Damage feedback renders over enemy shells and mold.

Ineffective boss laser hits show expanding blue shield ripples at the beam endpoint. Ablation flames and sparks appear only while the beam deals damage.

Wing pickups use metal badges with matching colors and distinct weapon icons, rotating beacons, and a short arrival animation. The homing icon is a fixed crosshair with two shrinking lock-on circles. Muzzle flashes and collection bursts give immediate feedback. These effects use shared geometry and pooled instances, are warmed before launch, and need no new asset files.
