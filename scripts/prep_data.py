"""
prep_data.py: Transform raw Spotify track data into processed story.json for the scrollytelling site.

This script:
1. Loads 114,000 Spotify tracks from raw CSV
2. Cleans and filters data
3. Calculates statistics: popularity bins, feature comparisons, genre fingerprints
4. Generates effect sizes (Cohen's d) to identify which audio features separate hits from non-hits
5. Outputs JSON file used by index.html + js/charts.js for visualization
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

# ========================
# FILE PATHS & SETUP
# ========================
# Input: raw CSV file with all Spotify tracks
RAW = Path("data/raw/spotify_tracks.csv")
# Output: processed JSON file that the website loads
OUT = Path("data/processed/story.json")
# Create output directory if it doesn't exist
OUT.parent.mkdir(parents=True, exist_ok=True)


def cohen_d(a, b):
    """
    Calculate Cohen's d: a standardized effect size measuring the difference between two groups.
    
    Formula: (mean_a - mean_b) / pooled_std_dev
    
    Use this to compare hits vs non-hits across audio features.
    Larger |d| = bigger difference (e.g., d=1.5 means hits are much more energetic)
    
    Args:
        a, b: Two arrays of values to compare
    
    Returns:
        float: Cohen's d value (0 if insufficient data)
    """
    # Convert inputs to numpy arrays (floats for calculation)
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na, nb = len(a), len(b)
    
    # Need at least 2 samples in each group
    if na < 2 or nb < 2:
        return 0.0
    
    # Calculate standard deviation for each group (sample std, ddof=1)
    sa = a.std(ddof=1)
    sb = b.std(ddof=1)
    
    # Pooled standard deviation: combines variance from both groups
    pooled = math.sqrt(((na - 1) * sa * sa + (nb - 1) * sb * sb) / (na + nb - 2)) if (na + nb - 2) > 0 else 0.0
    
    # Avoid division by zero
    if pooled == 0:
        return 0.0
    
    # Cohen's d = standardized difference between means
    return float((a.mean() - b.mean()) / pooled)


# ========================
# LOAD & CLEAN DATA
# ========================
# Read the CSV file into a pandas DataFrame
df = pd.read_csv(RAW)

# Select only the columns we need (ignore the rest)
needed = [
    "track_id", "track_name", "artists", "album_name",
    "popularity", "duration_ms", "explicit",
    "danceability", "energy", "valence", "tempo",
    "acousticness", "instrumentalness", "liveness", "speechiness",
    "loudness", "key", "mode", "time_signature",
    "track_genre"
]
cols = [c for c in needed if c in df.columns]
df = df[cols].copy()

# Remove rows with missing critical values
df = df.dropna(subset=["popularity", "duration_ms", "track_genre"])
print(f"Loaded {len(df):,} tracks.")

# ========================
# IDENTIFY DUPLICATES (same track_name + artists)
# ========================
# Find rows that have the same track_name AND artists
duplicates_mask = df.duplicated(subset=["track_name", "artists"], keep=False)
n_duplicates_before = duplicates_mask.sum()

if n_duplicates_before > 0:
    print(f"\n🔍 Found {n_duplicates_before} rows that are duplicates (same track_name + artists)")
    
    # Show which columns differ among duplicates
    duplicate_rows = df[duplicates_mask].sort_values(["track_name", "artists"])
    
    print("\nSample duplicate entries:")
    print("=" * 100)
    
    # Show first few duplicate sets
    for track_name in duplicate_rows["track_name"].unique()[:3]:  # Show first 3 duplicates
        dups = duplicate_rows[duplicate_rows["track_name"] == track_name]
        print(f"\n📌 Track: '{track_name}'")
        
        # Find which columns differ
        different_cols = []
        for col in df.columns:
            if len(dups[col].unique()) > 1:  # Column has different values
                different_cols.append(col)
        
        if different_cols:
            print(f"   Columns that differ: {', '.join(different_cols)}")
            for col in different_cols:
                print(f"      {col}: {list(dups[col].unique())}")
        else:
            print(f"   All columns are identical (exact duplicate)")
    
    print("\n" + "=" * 100)

# ========================
# MERGE DUPLICATES WITH RULES
# ========================
# Audio features to average
audio_features_to_avg = [
    "popularity", "danceability", "energy", "valence", "tempo",
    "acousticness", "instrumentalness", "liveness", "speechiness", "loudness"
]

# Fields that if different, mean we should keep rows separate
# Note: do NOT keep separate when `track_id` differs — we'll take the first `track_id` instead
keep_separate_if_different = ["duration_ms", "explicit"]

print("🔄 Merging duplicates ...")

# Check for rows that should be kept separate (different track_id, duration, or explicit)
df["_should_keep_separate"] = False

for idx, group_df in df.groupby(["track_name", "artists"]):
    if len(group_df) > 1:  # Only check groups with duplicates
        for col in keep_separate_if_different:
            if col in group_df.columns and len(group_df[col].unique()) > 1:
                # Mark these rows to keep separate
                df.loc[group_df.index, "_should_keep_separate"] = True
                break

# Split into two: mergeable and non-mergeable
mergeable_df = df[~df["_should_keep_separate"]].copy()
keep_separate_df = df[df["_should_keep_separate"]].copy()

# Merge the mergeable ones using agg
if len(mergeable_df) > 0:
    # Create aggregation dict
    agg_dict = {}
    
    # Average these features
    for feat in audio_features_to_avg:
        if feat in mergeable_df.columns:
            agg_dict[feat] = "mean"
    
    # Concatenate genres
    if "track_genre" in mergeable_df.columns:
        agg_dict["track_genre"] = lambda x: ";".join(sorted(set(";".join(x.astype(str)).split(";"))))
    
    # Concatenate albums
    if "album_name" in mergeable_df.columns:
        agg_dict["album_name"] = lambda x: ";".join(sorted(set(x.dropna().astype(str))))
    
    # Keep first value for other columns
    for col in mergeable_df.columns:
        if col not in agg_dict and col != "_should_keep_separate":
            agg_dict[col] = "first"
    
    # Group and aggregate
    merged = mergeable_df.groupby(["track_name", "artists"], as_index=False).agg(agg_dict)
    
    # Combine: merged + kept_separate
    # Only drop the helper column if it exists (avoid KeyError)
    if "_should_keep_separate" in keep_separate_df.columns:
        keep_separate_df = keep_separate_df.drop(columns=["_should_keep_separate"])
    if "_should_keep_separate" in merged.columns:
        merged = merged.drop(columns=["_should_keep_separate"])
    df = pd.concat([merged, keep_separate_df], ignore_index=True)
else:
    # Drop helper column only if present
    if "_should_keep_separate" in keep_separate_df.columns:
        df = keep_separate_df.drop(columns=["_should_keep_separate"])
    else:
        df = keep_separate_df

if n_duplicates_before > 0:
    print(f"\n✓ Processed {n_duplicates_before} duplicate rows")
    print(f"  Final track count: {len(df):,}")
    print(f"  Rules applied:")
    print(f"    - track_genre: concatenated with ';'")
    print(f"    - album_name: concatenated with ';'")
    print(f"    - Audio features: averaged")
    print(f"    - If duration_ms/explicit differ: kept separate")
    print(f"    - If track_id differs: first track_id is used")

# Convert duration from milliseconds to minutes (easier to work with)
df["duration_min"] = df["duration_ms"] / 60000.0

# Extract unique artist count (split by ";" for multi-artist tracks)
artist_sets = df["artists"].astype(str).str.split(";")
unique_artists = len(set(a.strip() for sub in artist_sets for a in sub if a.strip()))

# Explode multi-genre entries early so genre-level analyses can use it
df_genres = df.copy()
if "track_genre" in df_genres.columns:
    df_genres["track_genre"] = df_genres["track_genre"].astype(str).str.split(";")
    df_genres = df_genres.explode("track_genre")
    df_genres["track_genre"] = df_genres["track_genre"].astype(str).str.strip()
else:
    df_genres = df_genres.assign(track_genre="")

# Basic dataset stats
n_tracks = int(len(df))
# Number of unique genres (from exploded rows so multi-genre tracks count per genre)
n_genres = int(df_genres["track_genre"].nunique())

# Explicit track rate (% of tracks marked as explicit)
explicit_rate = float(np.mean(df["explicit"].astype(int))) if "explicit" in df.columns else None


# ========================
# SECTION 1: INTRO STATS
# ========================
# Select 3 representative tracks for the cold open:
# 1. Top hit (popularity ~100)
# 2. Median track (popularity ~34)
# 3. Long tail track (popularity < 10)
feature_cols_for_examples = [
    "track_id", "track_name", "artists", "track_genre", "popularity",
    "danceability", "energy", "loudness", "instrumentalness",
    "acousticness", "duration_min", "valence", "speechiness",
    "liveness", "tempo"
]
available_cols = [col for col in feature_cols_for_examples if col in df.columns]

# Get median popularity value
median_pop = df["popularity"].median()

# Select representative songs
top_hit = df.sort_values("popularity", ascending=False).head(1)[available_cols].to_dict(orient="records")[0]

# For median: exclude ASMR/sleep/ambient genres to get a real music track
median_candidates = df[~df["track_genre"].str.contains("sleep|asmr|ambient|white-noise", case=False, na=False)]
median_track = median_candidates.iloc[(median_candidates["popularity"] - median_pop).abs().argsort()[:1]][available_cols].to_dict(orient="records")[0] if len(median_candidates) > 0 else df.iloc[(df["popularity"] - median_pop).abs().argsort()[:1]][available_cols].to_dict(orient="records")[0]

# For long tail: pick a low-popularity track (excluding sleep/ASMR)
long_tail_candidates = df[(df["popularity"] < 10) & ~df["track_genre"].str.contains("sleep|asmr|ambient|white-noise", case=False, na=False)]
long_tail = long_tail_candidates.sample(n=1, random_state=42)[available_cols].to_dict(orient="records")[0] if len(long_tail_candidates) > 0 else df.sort_values("popularity").head(1)[available_cols].to_dict(orient="records")[0]

# Also get top 10 hits for the dot plot visualization
top_10_hits = (
    df.sort_values("popularity", ascending=False)
      .head(10)[available_cols]
      .to_dict(orient="records")
)

examples = [top_hit, median_track, long_tail] + top_10_hits

# Compile intro section: overview statistics
intro = {
    "tracks": n_tracks,                                    # Total tracks analyzed
    "unique_artists": unique_artists,                      # How many different artists
    "unique_genres": n_genres,                             # How many different genres
    "explicit_rate": explicit_rate,                        # % of tracks that are explicit
    "median_popularity": float(df["popularity"].median()), # Middle popularity score
    "median_duration_min": float(df["duration_min"].median()), # Middle song length
    "median_tempo": float(df["tempo"].median()) if "tempo" in df.columns else None,
    "example_hits": examples                               # Top 10 tracks by popularity
}


# ========================
# SECTION 2: POPULARITY SPECTRUM
# ========================
# Divide popularity (0-100) into 5-point bins (0-4, 5-9, 10-14, ..., 95-99, 100)
bins = list(range(0, 105, 5))
labels = [f"{bins[i]}-{bins[i+1]-1}" for i in range(len(bins) - 1)]
df["pop_bin_5"] = pd.cut(df["popularity"], bins=[-1] + bins[1:], labels=labels)

# Count tracks in each bin (histogram)
hist = (
    df["pop_bin_5"].value_counts()
      .reindex(labels)
      .fillna(0)
      .astype(int)
)
pop_hist = [{"bin": k, "count": int(v)} for k, v in hist.items()]

# Calculate key percentiles (where are the cutoffs for top 10%, 25%, etc.)
quantiles = {str(q): float(df["popularity"].quantile(q)) for q in [0.1, 0.25, 0.5, 0.75, 0.9]}

# Define "hit" = top 10% by popularity
hit_threshold = float(df["popularity"].quantile(0.90))
df["is_hit"] = df["popularity"] >= hit_threshold

# Also create 10-point bands for feature analysis (easier to plot trends)
band_labels = ["0-9","10-19","20-29","30-39","40-49","50-59","60-69","70-79","80-89","90-100"]
df["pop_band_10"] = pd.cut(
    df["popularity"],
    bins=[-1,9,19,29,39,49,59,69,79,89,100],
    labels=band_labels
)


# ========================
# SECTION 3: FEATURE ANATOMY
# ========================
# These are the audio features Spotify measures for each track
feature_cols = [
    "danceability", "energy", "valence", "tempo",
    "acousticness", "instrumentalness", "liveness", "speechiness",
    "loudness", "duration_min"
]
feature_cols = [c for c in feature_cols if c in df.columns]

# Split data: top 10% (hits) vs bottom 10% (non-hits)
top = df[df["popularity"] >= df["popularity"].quantile(0.90)]
bottom = df[df["popularity"] <= df["popularity"].quantile(0.10)]

# For each audio feature, calculate difference between hits and non-hits
anatomy = []
for f in feature_cols:
    a = top[f].dropna().values
    b = bottom[f].dropna().values
    anatomy.append({
        "feature": f,
        "mean_top10": float(np.mean(a)) if len(a) else None,    # Average value for hits
        "mean_bottom10": float(np.mean(b)) if len(b) else None,  # Average value for non-hits
        "delta": float(np.mean(a) - np.mean(b)) if len(a) and len(b) else None,  # Raw difference
        "cohen_d": cohen_d(a, b)  # Standardized difference (effect size)
    })
# Sort by strongest effect (largest |cohen_d|)
anatomy = sorted(anatomy, key=lambda x: abs(x["cohen_d"]), reverse=True)

# Calculate mean features for each popularity band (to show trends)
feature_by_band = (
    df.groupby("pop_band_10")[feature_cols]
      .mean(numeric_only=True)
      .reset_index()
)
feature_by_band = [
    {"pop_band": str(r["pop_band_10"]), **{c: float(r[c]) for c in feature_cols}}
    for _, r in feature_by_band.iterrows()
]


# ========================
# SECTION 4: GENRE FINGERPRINTS
# ========================
# Many tracks have multiple genres separated by ';'. For genre analysis we
# want to count and analyze a track under each listed genre. Create an
# exploded view for genre-level statistics so each (track, genre) pair is
# considered separately.
TOP_N_GENRES = 12

# Explode multi-genre entries into one row per genre (trim whitespace)
df_genres = df.copy()
if "track_genre" in df_genres.columns:
    df_genres["track_genre"] = df_genres["track_genre"].astype(str).str.split(";")
    df_genres = df_genres.explode("track_genre")
    df_genres["track_genre"] = df_genres["track_genre"].astype(str).str.strip()
else:
    df_genres = df_genres.assign(track_genre="")

# Number of unique genres (from exploded rows so multi-genre tracks count per genre)
n_genres = int(df_genres["track_genre"].nunique())

# For each genre, calculate stats using the exploded rows so a multi-genre
# track contributes to each of its genres
genre_stats_all = (
    df_genres
      .groupby("track_genre")
      .agg(
          count=("track_id", "size"),
          popularity_mean=("popularity", "mean"),
          hit_share=("is_hit", "mean"),
          explicit_rate=("explicit", lambda s: float(np.mean(s.astype(int)))) if "explicit" in df_genres.columns else ("popularity", "mean"),
          danceability=("danceability", "mean") if "danceability" in df_genres.columns else ("popularity", "mean"),
          energy=("energy", "mean") if "energy" in df_genres.columns else ("popularity", "mean"),
          valence=("valence", "mean") if "valence" in df_genres.columns else ("popularity", "mean"),
          acousticness=("acousticness", "mean") if "acousticness" in df_genres.columns else ("popularity", "mean"),
          instrumentalness=("instrumentalness", "mean") if "instrumentalness" in df_genres.columns else ("popularity", "mean"),
          speechiness=("speechiness", "mean") if "speechiness" in df_genres.columns else ("popularity", "mean"),
          tempo=("tempo", "mean") if "tempo" in df_genres.columns else ("popularity", "mean"),
          duration_min=("duration_min", "mean"),
          loudness=("loudness", "mean") if "loudness" in df_genres.columns else ("popularity", "mean"),
      )
      .reset_index()
)

# Compute top genres by highest average popularity
top_genres = (
    genre_stats_all.sort_values("popularity_mean", ascending=False)
      .head(TOP_N_GENRES)["track_genre"]
      .tolist()
)

genre_stats = genre_stats_all[genre_stats_all["track_genre"].isin(top_genres)].reset_index(drop=True)

# Calculate Z-scores for each feature in each genre (standardize across genres)
# Z-score = (value - genre_avg) / genre_std_dev
# This shows which features are unusually high/low for each genre
fingerprint_features = [c for c in ["danceability","energy","valence","acousticness","instrumentalness","speechiness","tempo","loudness","duration_min"] if c in genre_stats.columns]
z_rows = []
for feat in fingerprint_features:
    vals = genre_stats[feat].astype(float).values
    mu = float(np.mean(vals))  # Average across genres
    sd = float(np.std(vals)) if float(np.std(vals)) != 0 else 1.0  # Spread across genres
    for _, row in genre_stats.iterrows():
        z_rows.append({
            "genre": row["track_genre"],
            "feature": feat,
            "z": float((float(row[feat]) - mu) / sd)  # How many std devs away from mean
        })

# Format genre data for output
genre_table = []
for _, r in genre_stats.iterrows():
    item = {"genre": r["track_genre"], "count": int(r["count"])}
    for c in ["popularity_mean","explicit_rate","hit_share"] + fingerprint_features:
        if c in r:
            item[c] = float(r[c])
    genre_table.append(item)


# ========================
# SECTION 5: HIT BLUEPRINT
# ========================
# Calculate global averages for each audio feature
global_means = {c: float(df[c].mean()) for c in feature_cols}

# Calculate averages for top 10% (hits)
hit_means = {c: float(top[c].mean()) for c in feature_cols}

# Calculate the delta (how much higher/lower hits are vs overall avg)
deltas = {c: float(hit_means[c] - global_means[c]) for c in feature_cols}


# ========================
# SECTION 6: GENRE OVERREPRESENTATION
# ========================
# Find genres that punch above their weight (more hits than expected by their share)
# Use exploded genre rows so multi-genre tracks contribute to each genre.
overall_share = df_genres["track_genre"].value_counts(normalize=True)  # % of all tracks in each genre
hit_share = df_genres[df_genres["is_hit"]]["track_genre"].value_counts(normalize=True)  # % of hits in each genre
ratio = (hit_share / overall_share).dropna().sort_values(ascending=False)  # hit_share / overall_share

genre_overrep = []
for genre, r in ratio.head(10).items():
    genre_overrep.append({
        "genre": genre,
        "ratio": float(r),                            # How many times overrepresented (e.g., 1.5 = 50% more hits)
        "hit_share": float(hit_share.get(genre, 0.0)),      # % of hits from this genre
        "overall_share": float(overall_share.get(genre, 0.0))  # % of all tracks from this genre
    })

# ---------- SECTION 1: Intro + hook ----------
# (examples already defined above)

intro = {
    "tracks": n_tracks,
    "unique_artists": unique_artists,
    "unique_genres": n_genres,
    "explicit_rate": explicit_rate,
    "median_popularity": float(df["popularity"].median()),
    "median_duration_min": float(df["duration_min"].median()),
    "median_tempo": float(df["tempo"].median()) if "tempo" in df.columns else None,
    "example_hits": examples
}

# -----------------------------
# STEP 3: Feature anatomy data
# (Effect sizes: hit vs non-hit)
# -----------------------------

# ensure duration_min exists
if "duration_min" not in df.columns and "duration_ms" in df.columns:
    df["duration_min"] = df["duration_ms"] / 60000.0

# define hits as top 10% by popularity
hit_threshold = float(df["popularity"].quantile(0.90))
df["is_hit"] = df["popularity"] >= hit_threshold

# Choose the features you want to compare (match your site’s visuals)
feature_cols = [
    "danceability", "energy", "valence", "acousticness",
    "instrumentalness", "liveness", "speechiness",
    "tempo", "loudness", "duration_min"
]

hit_df = df[df["is_hit"]]
non_df = df[~df["is_hit"]]

feature_effects = []
for col in feature_cols:
    if col not in df.columns:
        continue

    x_hit = hit_df[col].dropna()
    x_non = non_df[col].dropna()
    if len(x_hit) < 30 or len(x_non) < 30:
        continue

    m_hit = float(x_hit.mean())
    m_non = float(x_non.mean())
    s_hit = float(x_hit.std(ddof=1))
    s_non = float(x_non.std(ddof=1))

    # pooled std for Cohen's d
    n1, n2 = len(x_hit), len(x_non)
    pooled = (((n1 - 1) * (s_hit ** 2) + (n2 - 1) * (s_non ** 2)) / (n1 + n2 - 2)) ** 0.5
    d = (m_hit - m_non) / pooled if pooled > 0 else 0.0

    feature_effects.append({
        "feature": col,
        "hit_mean": m_hit,
        "non_hit_mean": m_non,
        "delta": m_hit - m_non,      # raw difference
        "cohen_d": d                  # standardized difference
    })

# sort by strongest standardized difference
feature_effects.sort(key=lambda r: abs(r["cohen_d"]), reverse=True)

# ---------- ADDITION: Explicit Popularity Analysis ----------
explicit_pop = df.groupby("explicit")["popularity"].mean()

# Calculate hit rates for explicit vs non-explicit
explicit_tracks = df[df["explicit"] == True]
non_explicit_tracks = df[df["explicit"] == False]
explicit_hit_rate = (explicit_tracks["popularity"] >= hit_threshold).mean()
non_explicit_hit_rate = (non_explicit_tracks["popularity"] >= hit_threshold).mean()

explicit_analysis = {
    "explicit_mean_pop": float(explicit_pop.get(True, 0.0)),
    "non_explicit_mean_pop": float(explicit_pop.get(False, 0.0)),
    "delta": float(explicit_pop.get(True, 0.0) - explicit_pop.get(False, 0.0)),
    "explicit_hit_rate": float(explicit_hit_rate),
    "non_explicit_hit_rate": float(non_explicit_hit_rate),
    "explicit_count": int(len(explicit_tracks)),
    "non_explicit_count": int(len(non_explicit_tracks))
}

# ---------- ADDITION: Duration-Popularity Correlation ----------
corr_duration_pop = float(df["duration_min"].corr(df["popularity"]))

# Extract top 8 most impactful features (by effect size)
top_effects = anatomy[:8]


story = {
    "intro": intro,
    "popularity_spectrum": {
        "hist_5pt": pop_hist,
        "quantiles": quantiles,
        "hit_threshold_top10": hit_threshold
    },
    "feature_anatomy": {
        "effect_sizes": anatomy,
        "feature_effects": feature_effects,
        "means_by_pop_band": feature_by_band,
        "feature_list": feature_cols,
    },
    "genre_fingerprints": {
        "top_genres": top_genres,
        "genre_table": genre_table,
        "z_scores": z_rows,
        "features": fingerprint_features
    },
    "hit_blueprint": {
        "hit_threshold_top10": hit_threshold,
        "global_means": global_means,
        "hit_means": hit_means,
        "deltas": deltas
    },
    "hit_threshold": hit_threshold,
    "feature_effects": feature_effects,
    "takeaway": {
        "top_effects": top_effects,
        "genre_overrepresentation": genre_overrep,
        "explicit_analysis": explicit_analysis,
        "duration_pop_correlation": corr_duration_pop
    },
    "explicit_analysis": explicit_analysis,
    "corr_duration_pop": corr_duration_pop
}

OUT.write_text(json.dumps(story, indent=2), encoding="utf-8")
print(f"Wrote {OUT} with {n_tracks} rows used.")
