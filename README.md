# NEON TOWER — Apex Edition

Neon Tower is a browser-based tower-defense game with a separate mobile layout and an optional Capacitor app build.

## Game modes

- **Infinite Mode:** endless wave progression, escalating enemy types and Boss encounters every five waves.
- **Level Mode:** a 30-level campaign with individual objectives and rewards.

## Gameplay systems

- Three permanent upgrade paths: Attack, Defense and Utility.
- In-run upgrades, milestone Perks and wave decisions.
- Minions, Tanks, Kamikazes, Snipers, Scouts, Elites and Bosses.
- Homing projectiles, missiles, lasers and enemy projectile patterns.
- Local progress saves, wave-start run checkpoints and optional account-linked cloud saves.
- Global and weekly leaderboards for eligible signed-in accounts.

## Save and resume behaviour

A run checkpoint represents the beginning of the interrupted wave. Resuming restarts that wave from its saved baseline, rather than restoring every enemy and projectile at the exact frame where the game was closed. Progress earned during the interrupted wave is rolled back with that wave so replaying it cannot award the same kills, coins or Boss rewards twice.

Local backups are best-effort browser storage. Cloud saves and leaderboard features require an internet connection and a signed-in account. The game is still client-simulated, so server-side score checks reduce simple score manipulation but cannot provide the same tamper resistance as a fully server-authoritative game.

## Development

Install the dependencies:

```bash
npm install
```

Prepare the web assets for Capacitor:

```bash
npm run build
```

The build copies the game scripts, campaign configuration, PWA manifest, icon and service worker into `www/`.

For Android or iOS setup instructions, see [MOBILE-APP-SETUP.md](MOBILE-APP-SETUP.md).

## Testing

Run the browser game from the repository or its GitHub Pages deployment. Before a native release, test campaign loading, local and cloud save recovery, leaderboard submissions, offline behaviour, background/resume behaviour, audio and screen sizing on real devices.