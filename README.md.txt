# Anatomy of a Hit (Spotify) — Mini Website

## How to run
### On macOS/Linux:
1. Open Terminal in this folder
2. Run: `python -m http.server 8000`
3. Open: http://localhost:8000/index.html

### On Windows:
1. Open CMD in this folder
2. Run: `py -m http.server 8000`
3. Open: http://localhost:8000/index.html

## What is what
- `index.html` = page structure / scrollytelling sections
- `css/style.css` = styling
- `js/main.js` = scrollytelling logic (step switching, mode toggle)
- `js/charts.js` = chart rendering functions
- `data/processed/story.json` = processed data used by the site
- `scripts/prep_data.py` = script to regenerate story.json (optional)

## Regenerate story.json (optional)
### On macOS/Linux:
Run: `python scripts/prep_data.py`

### On Windows:
Run: `py scripts\prep_data.py`

Output: `data/processed/story.json`

## Troubleshooting
- If the server doesn't start, ensure Python is installed (check with `python --version`).
- If charts don't load, check browser console for errors (likely data loading issues).
- For data regeneration, ensure required Python packages are installed (see `scripts/prep_data.py` for dependencies).
