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
all_artists_list = []
for artists_str in df['Artists']:
    all_artists_list.extend(parse_artists(artists_str))

global_artist_counts = Counter(all_artists_list)

print("Calculating genre popularity scores...")
genre_popularity = {}

for genre, group in df.groupby('Genre'):
    # Get all artists in this genre
    genre_artists_nested = [parse_artists(x) for x in group['Artists']]
    genre_artists = [item for sublist in genre_artists_nested for item in sublist]
    
    if not genre_artists:
        continue
        
    # Get top 20 prominent artists for this genre (by count within genre)
    artist_counts_in_genre = Counter(genre_artists)
    prominent_artists = [a for a, count in artist_counts_in_genre.most_common(20)]
    
    # Calculate average global popularity (count) of these prominent artists
    avg_global_pop = sum(global_artist_counts[a] for a in prominent_artists) / len(prominent_artists)
    
    genre_popularity[genre] = {
        'avg_global_pop': avg_global_pop,
        'prominent_artists': prominent_artists[:5]
    }

# Sort and get top
sorted_genres = sorted(genre_popularity.items(), key=lambda x: x[1]['avg_global_pop'], reverse=True)

print("\nTop 10 Genres with Most 'Popular' (Frequently Occurring) Artists:")
for i, (genre, data) in enumerate(sorted_genres[:10]):
    print(f"{i+1}. {genre} (Score: {data['avg_global_pop']:.2f})")
    print(f"   Artists: {', '.join(data['prominent_artists'])}")
