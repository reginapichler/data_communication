import json
import math
from pathlib import Path

import numpy as np
import pandas as pd


RAW = Path("data/raw/spotify_tracks.csv")
OUT = Path("data/processed/story.json")
OUT.parent.mkdir(parents=True, exist_ok=True)


def cohen_d(a, b):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return 0.0
    sa = a.std(ddof=1)
    sb = b.std(ddof=1)
    pooled = math.sqrt(((na - 1) * sa * sa + (nb - 1) * sb * sb) / (na + nb - 2)) if (na + nb - 2) > 0 else 0.0
    if pooled == 0:
        return 0.0
    return float((a.mean() - b.mean()) / pooled)


df = pd.read_csv(RAW)

# Keep only what we need
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

# Minimal cleaning
df = df.dropna(subset=["popularity", "duration_ms", "track_genre"])
df["duration_min"] = df["duration_ms"] / 60000.0

# Artists: split multi-artists by ";"
artist_sets = df["artists"].astype(str).str.split(";")
unique_artists = len(set(a.strip() for sub in artist_sets for a in sub if a.strip()))

n_tracks = int(len(df))
n_genres = int(df["track_genre"].nunique())

explicit_rate = float(np.mean(df["explicit"].astype(int))) if "explicit" in df.columns else None

# ---------- SECTION 2: Popularity Spectrum ----------
# 5-point bins (0-4, 5-9, ..., 95-99, 100-100)
bins = list(range(0, 105, 5))
labels = [f"{bins[i]}-{bins[i+1]-1}" for i in range(len(bins) - 1)]
df["pop_bin_5"] = pd.cut(df["popularity"], bins=[-1] + bins[1:], labels=labels)

hist = (
    df["pop_bin_5"].value_counts()
      .reindex(labels)
      .fillna(0)
      .astype(int)
)
pop_hist = [{"bin": k, "count": int(v)} for k, v in hist.items()]

quantiles = {str(q): float(df["popularity"].quantile(q)) for q in [0.1, 0.25, 0.5, 0.75, 0.9]}

hit_threshold = float(df["popularity"].quantile(0.90))
df["is_hit"] = df["popularity"] >= hit_threshold

# ---------- SECTION 3: Feature-by-feature anatomy ----------
feature_cols = [
    "danceability", "energy", "valence", "tempo",
    "acousticness", "instrumentalness", "liveness", "speechiness",
    "loudness", "duration_min"
]
feature_cols = [c for c in feature_cols if c in df.columns]

top = df[df["popularity"] >= df["popularity"].quantile(0.90)]
bottom = df[df["popularity"] <= df["popularity"].quantile(0.10)]

anatomy = []
for f in feature_cols:
    a = top[f].dropna().values
    b = bottom[f].dropna().values
    anatomy.append({
        "feature": f,
        "mean_top10": float(np.mean(a)) if len(a) else None,
        "mean_bottom10": float(np.mean(b)) if len(b) else None,
        "delta": float(np.mean(a) - np.mean(b)) if len(a) and len(b) else None,
        "cohen_d": cohen_d(a, b)
    })
anatomy = sorted(anatomy, key=lambda x: abs(x["cohen_d"]), reverse=True)

# Also: feature means by popularity band (10-point bins)
band_labels = ["0-9","10-19","20-29","30-39","40-49","50-59","60-69","70-79","80-89","90-100"]
df["pop_band_10"] = pd.cut(
    df["popularity"],
    bins=[-1,9,19,29,39,49,59,69,79,89,100],
    labels=band_labels
)
feature_by_band = (
    df.groupby("pop_band_10")[feature_cols]
      .mean(numeric_only=True)
      .reset_index()
)
feature_by_band = [
    {"pop_band": str(r["pop_band_10"]), **{c: float(r[c]) for c in feature_cols}}
    for _, r in feature_by_band.iterrows()
]

# ---------- SECTION 4: Genre fingerprints ----------
# Pick N genres (by count) to keep visuals readable
TOP_N_GENRES = 12
genre_counts = df["track_genre"].value_counts().head(TOP_N_GENRES)
top_genres = genre_counts.index.tolist()

genre_stats = (
    df[df["track_genre"].isin(top_genres)]
      .groupby("track_genre")
      .agg(
          count=("track_id", "size"),
          popularity_mean=("popularity", "mean"),
          hit_share=("is_hit", "mean"),
          explicit_rate=("explicit", lambda s: float(np.mean(s.astype(int)))) if "explicit" in df.columns else ("popularity", "mean"),
          danceability=("danceability", "mean") if "danceability" in df.columns else ("popularity", "mean"),
          energy=("energy", "mean") if "energy" in df.columns else ("popularity", "mean"),
          valence=("valence", "mean") if "valence" in df.columns else ("popularity", "mean"),
          acousticness=("acousticness", "mean") if "acousticness" in df.columns else ("popularity", "mean"),
          instrumentalness=("instrumentalness", "mean") if "instrumentalness" in df.columns else ("popularity", "mean"),
          speechiness=("speechiness", "mean") if "speechiness" in df.columns else ("popularity", "mean"),
          tempo=("tempo", "mean") if "tempo" in df.columns else ("popularity", "mean"),
          duration_min=("duration_min", "mean"),
          loudness=("loudness", "mean") if "loudness" in df.columns else ("popularity", "mean"),
      )
      .reset_index()
)

# Z-scores for fingerprint heatmap (across selected genres)
fingerprint_features = [c for c in ["danceability","energy","valence","acousticness","instrumentalness","speechiness","tempo","loudness","duration_min"] if c in genre_stats.columns]
z_rows = []
for feat in fingerprint_features:
    vals = genre_stats[feat].astype(float).values
    mu = float(np.mean(vals))
    sd = float(np.std(vals)) if float(np.std(vals)) != 0 else 1.0
    for _, row in genre_stats.iterrows():
        z_rows.append({
            "genre": row["track_genre"],
            "feature": feat,
            "z": float((float(row[feat]) - mu) / sd)
        })

genre_table = []
for _, r in genre_stats.iterrows():
    item = {"genre": r["track_genre"], "count": int(r["count"])}
    for c in ["popularity_mean","explicit_rate","hit_share"] + fingerprint_features:
        if c in r:
            item[c] = float(r[c])
    genre_table.append(item)

# ---------- SECTION 5: Hit blueprint ----------
global_means = {c: float(df[c].mean()) for c in feature_cols}
hit_means = {c: float(top[c].mean()) for c in feature_cols}
deltas = {c: float(hit_means[c] - global_means[c]) for c in feature_cols}

# ---------- SECTION 6: Takeaway ----------
# Rank features by absolute effect size
top_effects = anatomy[:8]

# Genres overrepresented among hits: (hit share / overall share)
overall_share = df["track_genre"].value_counts(normalize=True)
hit_share = df[df["is_hit"]]["track_genre"].value_counts(normalize=True)
ratio = (hit_share / overall_share).dropna().sort_values(ascending=False)

genre_overrep = []
for genre, r in ratio.head(10).items():
    genre_overrep.append({
        "genre": genre,
        "ratio": float(r),
        "hit_share": float(hit_share.get(genre, 0.0)),
        "overall_share": float(overall_share.get(genre, 0.0))
    })

# ---------- SECTION 1: Intro + hook ----------
# Example "hits" (top popularity tracks)
examples = (
    df.sort_values("popularity", ascending=False)
      .head(10)[["track_name","artists","track_genre","popularity"]]
      .to_dict(orient="records")
)

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
explicit_analysis = {
    "explicit_mean_pop": float(explicit_pop.get(True, 0.0)),
    "non_explicit_mean_pop": float(explicit_pop.get(False, 0.0)),
    "delta": float(explicit_pop.get(True, 0.0) - explicit_pop.get(False, 0.0))
}

# ---------- ADDITION: Duration-Popularity Correlation ----------
corr_duration_pop = float(df["duration_min"].corr(df["popularity"]))


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
