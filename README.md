# Grid Armor

A compact, zero-dependency 2D tank defense game built for GitHub Pages.

## Gameplay

- The arena is a fixed 20 by 30 grid.
- Arrow keys move the player exactly one cell.
- `X` fires the current weapon.
- Enemy tanks enter from the northwest corner and attack both the player and base.
- Breaking wooden obstacles may reveal a three-hit shield, a line-clearing laser charge, or a mine.
- The match ends when the player tank or base is destroyed.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## GitHub Pages

Push to `main`. The included workflow publishes the repository root to GitHub Pages.
