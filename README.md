[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/AT79x/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/AT79x/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay — an open-world crime game

A 2D top-down open-world crime game for make.fun's **Make GTA 6** bounty
([gta6-01](https://make.fun/bounty/gta6-01)). An original game in every way:
its own city, names, story, art and sounds — nothing from any commercial game.

**Rex Marlowe**, a courier in the sun-soaked coastal city of **Solmar Bay**,
owes $20,000 to the fixer **Vera Kessler**. Drive, steal, run — and pay it back.

## What is in the game

- **A city to explore** — downtown, Palm Court suburbs, Sunset Beach, the
  Harbour Docks and Marlowe Plaza: grid streets, buildings, parks, beach and sea.
- **On foot and by car** — walk, sprint, steal parked and traffic cars (sedan,
  taxi, van, sports) with different speed and handling. Press **E** to enter/exit.
- **Traffic and pedestrians** — cars drive the roads and turn at junctions,
  pedestrians walk the pavements.
- **Wanted level (1–5 stars)** — stealing cars, hitting pedestrians and shooting
  raise the heat. Police interceptors chase and ram; foot police pursue and bust
  you. Lay low and the heat cools off.
- **Story: 6 missions** — First Fare, The Package, Collect the Debt, Heat Wave,
  Warehouse War, and The Big Score — each with objective markers, briefings and
  cash rewards that pay the debt down.
- **Side work** — taxi fares, street packages ($50 each) and time trials.
- **Combat** — punch (F) and a pistol (mouse aim, click to shoot), rival
  **Crimson Vipers** gang members, health and armour pickups.
- **HUD with minimap** — cash, debt, clock, health, armour, ammo, wanted stars,
  mission objective, speed, and a live minimap (player, cars, police, markers).
- **Menus and save** — title screen, pause menu, busted / wasted screens, and
  save + load via localStorage.
- **Polish** — golden-hour lighting, shadows, dust, muzzle flashes, explosions,
  a smooth following camera, procedural WebAudio sound effects and a music loop.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim and shoot the pistol |
| E | Enter / exit car, pick up a package |
| F | Punch |
| Shift | Sprint on foot, handbrake in a car |
| Space | Horn (in a car) |
| M | Start the next story job |
| T | Start a time trial |
| P / Esc | Pause |
| S (paused) | Save game |
| Q (paused) | Quit to title |

### Touch controls (phones and tablets)

On a touch device the game shows a virtual stick (bottom left) for moving and
driving, and buttons for TEMBAK (hold to keep firing), MASUK (enter/exit car),
MISI (next story job), PUKUL, LARI (sprint / handbrake) and JEDA (pause).
Tap the world to aim; the pistol only refills from ammo pickups, so walk to
one when the magazine runs dry. While driving, push the stick where you want
the car to go — steering is relative to the screen, not the car's nose. Push
the stick back (behind the car) to reverse, so you can back out if you get
stuck nose-first against a wall; the car also steers at low speed now.
Pinch or use the + / − buttons (left edge) to zoom the world in and out; the
HUD is drawn in screen pixels, so it stays readable on phones.
| C (title) | Continue from save |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: static files under `game/`, vanilla JS, Canvas 2D,
all assets drawn in code and all sound synthesized with WebAudio.

## Layout

- `game/index.html` — the page and canvas
- `game/src/main.js` — game loop and screen state machine
- `game/src/world.js` — city generation and game state
- `game/src/config.js` — tuning, palette, content tables
- `game/src/random.js` — seeded RNG and helpers
- `game/src/vehicles.js` — car physics, stealing, damage
- `game/src/entities.js` — player, pedestrians, traffic, police AI
- `game/src/combat.js` — shooting, punching, pickups, wanted heat
- `game/src/missions.js` — story missions and side activities
- `game/src/render.js` — drawing, HUD, minimap, screens
- `game/src/audio.js` — procedural WebAudio effects and music
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`)
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `screenshots/` — 4 real renders of the game
