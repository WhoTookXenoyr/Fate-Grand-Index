# Fate/Grand Index

A Fate/Grand Order index of every NA servant and Craft Essence (Past Chaldea), plus your own Spirit Origin List: roster, Guests, parties, rankings, versus and a summoning simulator. It ships as one self-contained HTML file that saves everything in your own browser.

Status: **alpha** (`0.x`). Version 1.0.0 will be the full website and app.

## What's here right now

| Path | What it is |
|---|---|
| `dist/Fate_Grand_Index.html` | The current build (v0.19.0), the file you open in a browser. |
| `legacy/` | The sources exactly as they were built up to 0.19.0: a base page from 0.7.1 plus a chain of patch scripts (`patch_v8.py` … `patch_v21.py`) that each add a module. Kept so nothing is lost while the project moves to a clean structure. |

The legacy chain is being replaced by one clean source tree with a single build and tests that run on every change (0.20.0).

## Building the legacy version

Needs Python 3 and Node (for the syntax check).

```sh
cd legacy
python3 gen_atlas.py "$PWD"   # only when the Atlas data changes: rebuilds atlas_data.js from atlas/*.json.gz
bash build.sh "$PWD"          # writes out/Fate_Grand_Index.html (empty) and _seeded.html (sample roster, for tests)
```

## Tests

Browser tests use Playwright (Python) with Chromium. Run one suite with:

```sh
cd legacy
python3 tests/test_v21.py "$PWD"
```

## Data

- Servant and Craft Essence data: the Atlas Academy NA export (`legacy/atlas/*.json.gz`), turned into `atlas_data.js` by `gen_atlas.py`. Pictures are loaded from Atlas Academy, not copied into this repo.
- Your roster is stored in your browser (`localStorage` key `spirit-origin-list:v1`, pictures in IndexedDB `spirit-origin-list-images`). These names stay the same so existing saves keep working.

Fate/Grand Order is © TYPE-MOON / FGO PROJECT. This is an unofficial fan project, not affiliated with TYPE-MOON, Aniplex or Lasengle.
