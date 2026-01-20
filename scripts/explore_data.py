"""
explore_data.py: Quick exploration of the Spotify dataset to understand structure and patterns

This script loads the raw CSV and shows:
- Dataset shape (how many rows/columns)
- Basic statistics (min, max, mean, median)
- Data types and missing values
- Sample tracks
- Distribution of key features
"""

import pandas as pd
import numpy as np
from pathlib import Path

# ========================
# LOAD THE DATA
# ========================
# Define path to the raw CSV file
RAW_DATA = Path("data/raw/spotify_tracks.csv")

# Load the CSV into a pandas DataFrame
df = pd.read_csv(RAW_DATA)

print("=" * 80)
print("SPOTIFY DATASET EXPLORATION")
print("=" * 80)


# ========================
# 1. DATASET SHAPE & SIZE
# ========================
print("\n1. DATASET DIMENSIONS:")
print(f"   Total rows (tracks): {len(df):,}")
print(f"   Total columns: {len(df.columns)}")
print(f"   Dataset size: {len(df) * len(df.columns):,} data points")


# ========================
# 2. COLUMN NAMES & DATA TYPES
# ========================
print("\n2. COLUMNS & DATA TYPES:")
print(df.dtypes)


# ========================
# 3. MISSING VALUES
# ========================
print("\n3. MISSING VALUES (NULL/NaN):")
missing = df.isnull().sum()
missing_percent = (missing / len(df)) * 100
missing_df = pd.DataFrame({
    "Column": missing.index,
    "Missing_Count": missing.values,
    "Percent": missing_percent.values
})
# Only show columns with missing values
missing_df = missing_df[missing_df["Missing_Count"] > 0].sort_values("Missing_Count", ascending=False)
if len(missing_df) == 0:
    print("   No missing values found!")
else:
    print(missing_df.to_string(index=False))


# ========================
# 4. BASIC STATISTICS
# ========================
print("\n4. BASIC STATISTICS (Numeric Columns):")
print(df.describe().T)  # T = transpose (easier to read)


# ========================
# 5. POPULARITY DISTRIBUTION
# ========================
print("\n5. POPULARITY DISTRIBUTION:")
print(f"   Min popularity: {df['popularity'].min()}")
print(f"   Max popularity: {df['popularity'].max()}")
print(f"   Mean popularity: {df['popularity'].mean():.2f}")
print(f"   Median popularity: {df['popularity'].median():.2f}")
print(f"   Std Dev: {df['popularity'].std():.2f}")

# Show how many tracks are in each popularity range
print("\n   Tracks by popularity range:")
ranges = [(0, 20), (20, 40), (40, 60), (60, 80), (80, 100)]
for min_pop, max_pop in ranges:
    count = len(df[(df['popularity'] >= min_pop) & (df['popularity'] < max_pop)])
    percent = (count / len(df)) * 100
    print(f"      {min_pop}-{max_pop}: {count:>6,} tracks ({percent:>5.1f}%)")


# ========================
# 6. DURATION ANALYSIS
# ========================
print("\n6. SONG DURATION:")
df['duration_min'] = df['duration_ms'] / 60000  # Convert milliseconds to minutes
print(f"   Shortest song: {df['duration_min'].min():.1f} min")
print(f"   Longest song: {df['duration_min'].max():.1f} min")
print(f"   Average song length: {df['duration_min'].mean():.1f} min")
print(f"   Median song length: {df['duration_min'].median():.1f} min")


# ========================
# 7. AUDIO FEATURES OVERVIEW
# ========================
print("\n7. KEY AUDIO FEATURES:")
audio_features = ['danceability', 'energy', 'valence', 'acousticness', 'tempo', 'loudness']
for feature in audio_features:
    if feature in df.columns:
        mean_val = df[feature].mean()
        min_val = df[feature].min()
        max_val = df[feature].max()
        print(f"   {feature:>20}: range [{min_val:.2f}, {max_val:.2f}], avg = {mean_val:.2f}")


# ========================
# 8. GENRE DISTRIBUTION
# ========================
print("\n8. TOP 15 GENRES:")
genre_counts = df['track_genre'].value_counts().head(15)
for i, (genre, count) in enumerate(genre_counts.items(), 1):
    percent = (count / len(df)) * 100
    bar = "█" * int(percent / 2)  # Visual bar
    print(f"   {i:>2}. {genre:<20} {count:>6,} tracks ({percent:>5.1f}%) {bar}")


# ========================
# 9. EXPLICIT CONTENT
# ========================
print("\n9. EXPLICIT CONTENT:")
if 'explicit' in df.columns:
    explicit_count = df['explicit'].sum()
    explicit_percent = (explicit_count / len(df)) * 100
    print(f"   Explicit tracks: {explicit_count:,} ({explicit_percent:.1f}%)")
    print(f"   Clean tracks: {len(df) - explicit_count:,} ({100 - explicit_percent:.1f}%)")


# ========================
# 10. ARTIST ANALYSIS
# ========================
print("\n10. ARTIST INFORMATION:")
# Count how many artists are represented
unique_artists = df['artists'].astype(str).str.split(';')
all_artists = set()
for artist_list in unique_artists:
    for artist in artist_list:
        all_artists.add(artist.strip())

print(f"   Unique artists: {len(all_artists):,}")

# Find artists with most tracks
df['artist_main'] = df['artists'].str.split(';').str[0].str.strip()
top_artists = df['artist_main'].value_counts().head(10)
print("\n   Top 10 artists by track count:")
for i, (artist, count) in enumerate(top_artists.items(), 1):
    print(f"      {i:>2}. {artist:<25} {count:>3} tracks")


# ========================
# 11. SAMPLE TRACKS
# ========================
print("\n11. SAMPLE OF TRACKS (random 5):")
sample = df.sample(5)[['track_name', 'artists', 'popularity', 'track_genre', 'duration_min']]
for idx, (i, row) in enumerate(sample.iterrows(), 1):
    print(f"\n   Track {idx}:")
    print(f"      Name: {row['track_name']}")
    print(f"      Artist: {row['artists']}")
    print(f"      Genre: {row['track_genre']}")
    print(f"      Popularity: {row['popularity']}")
    print(f"      Duration: {row['duration_min']:.2f} min")


# ========================
# 12. MOST POPULAR TRACKS
# ========================
print("\n12. TOP 5 MOST POPULAR TRACKS:")
top_tracks = df.nlargest(5, 'popularity')[['track_name', 'artists', 'popularity', 'track_genre']]
for idx, (i, row) in enumerate(top_tracks.iterrows(), 1):
    print(f"   {idx}. {row['track_name']:<40} by {row['artists']:<30} (pop: {row['popularity']}, {row['track_genre']})")


# ========================
# 13. LEAST POPULAR TRACKS
# ========================
print("\n13. BOTTOM 5 LEAST POPULAR TRACKS:")
bottom_tracks = df.nsmallest(5, 'popularity')[['track_name', 'artists', 'popularity', 'track_genre']]
for idx, (i, row) in enumerate(bottom_tracks.iterrows(), 1):
    print(f"   {idx}. {row['track_name']:<40} by {row['artists']:<30} (pop: {row['popularity']}, {row['track_genre']})")


# ========================
# 14. CORRELATION INSIGHTS
# ========================
print("\n14. INTERESTING CORRELATIONS:")
# Check if energy correlates with popularity
energy_pop_corr = df['energy'].corr(df['popularity'])
print(f"   Energy vs Popularity: {energy_pop_corr:.3f}")

# Check if danceability correlates with popularity
dance_pop_corr = df['danceability'].corr(df['popularity'])
print(f"   Danceability vs Popularity: {dance_pop_corr:.3f}")

# Check if duration affects popularity
duration_pop_corr = df['duration_min'].corr(df['popularity'])
print(f"   Duration vs Popularity: {duration_pop_corr:.3f}")

# Check if explicit status affects popularity
if 'explicit' in df.columns:
    explicit_pop = df.groupby('explicit')['popularity'].mean()
    print(f"   Explicit tracks avg popularity: {explicit_pop.get(True, 0):.2f}")
    print(f"   Clean tracks avg popularity: {explicit_pop.get(False, 0):.2f}")


# ========================
# 15. DATA QUALITY CHECK
# ========================
print("\n15. DATA QUALITY CHECK:")
print(f"   Duplicate rows: {df.duplicated().sum()}")
print(f"   Rows with all values: {len(df.dropna())}")
print(f"   Rows with any missing value: {df.isnull().any(axis=1).sum()}")


# ========================
# 16. SHOW ROWS WITH MISSING VALUES
# ========================
print("\n16. ROWS WITH MISSING VALUES:")
rows_with_missing = df[df.isnull().any(axis=1)]

if len(rows_with_missing) == 0:
    print("   No rows with missing values!")
else:
    print(f"   Found {len(rows_with_missing)} row(s) with missing values:\n")
    
    for idx, (i, row) in enumerate(rows_with_missing.iterrows(), 1):
        print(f"   ROW {idx} (Index: {i}):")
        print(f"   {'-' * 76}")
        
        # Show all columns for this row
        for col in df.columns:
            value = row[col]
            # Highlight missing values
            if pd.isnull(value):
                print(f"      {col:<25} >>> MISSING/NULL <<<")
            else:
                # Truncate very long values
                val_str = str(value)
                if len(val_str) > 50:
                    val_str = val_str[:47] + "..."
                print(f"      {col:<25} {val_str}")
        print()

print("\n" + "=" * 80)
print("EXPLORATION COMPLETE!")
print("=" * 80)
