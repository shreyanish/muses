import pandas as pd
import ast
from collections import Counter

songs_csv_path = "/Users/shreyanish/.cache/kagglehub/datasets/nikitricky/every-noise-at-once/versions/2/songs.csv"
print("Loading data...")
df = pd.read_csv(songs_csv_path, usecols=['Genre', 'Artists'])

def parse_artists(x):
    try:
        return ast.literal_eval(x)
    except:
        return []

print("Counting global artist occurrences...")
all_artists = []
for artists_str in df['Artists']:
    all_artists.extend(parse_artists(artists_str))

artist_counts = Counter(all_artists)
top_50_artists = [a for a, count in artist_counts.most_common(50)]

print("\nTop 50 Artists and their primary genres:")
artist_to_genre = {}

# We need to re-parse to match artists to genres
for _, row in df.iterrows():
    genre = row['Genre']
    artists = parse_artists(row['Artists'])
    for a in artists:
        if a in top_50_artists:
            if a not in artist_to_genre:
                artist_to_genre[a] = Counter()
            artist_to_genre[a][genre] += 1

genre_leaderboard = Counter()
for a in top_50_artists:
    if a in artist_to_genre:
        primary_genre = artist_to_genre[a].most_common(1)[0][0]
        print(f"{a}: {primary_genre} ({artist_counts[a]} tracks)")
        genre_leaderboard[primary_genre] += 1

print("\nGenres with the most 'Superstars':")
for genre, count in genre_leaderboard.most_common(10):
    print(f"{genre}: {count} superstars")
