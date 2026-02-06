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

# List of classical composers to exclude (rough list)
exclude = {'Wolfgang Amadeus Mozart', 'Frédéric Chopin', 'Johann Sebastian Bach', 'Franz Liszt', 'Ludwig van Beethoven', 'Claude Debussy', 'Franz Schubert', 'Johannes Brahms', 'Pyotr Ilyich Tchaikovsky', 'Sergei Rachmaninoff', 'Antonio Vivaldi', 'George Frideric Handel', 'Richard Wagner', 'Giuseppe Verdi', 'Gioachino Rossini', 'Antonín Dvořák', 'Felix Mendelssohn', 'Robert Schumann', 'Maurice Ravel', 'Joseph Haydn', 'Franz Joseph Haydn', 'Igor Stravinsky', 'Sergei Prokofiev', 'Dmitri Shostakovich', 'Gustav Mahler', 'Richard Strauss', 'Jean Sibelius', 'Gabriel Fauré', 'Camille Saint-Saëns', 'Edward Elgar', 'Béla Bartók', 'Giacomo Puccini', 'Gaetano Donizetti', 'Vincenzo Bellini', 'Hector Berlioz', 'Georges Bizet'}

print("Calculating refined genre popularity scores...")
genre_popularity = {}

for genre, group in df.groupby('Genre'):
    genre_artists_nested = [parse_artists(x) for x in group['Artists']]
    genre_artists = [item for sublist in genre_artists_nested for item in sublist]
    
    if not genre_artists:
        continue
        
    artist_counts_in_genre = Counter(genre_artists)
    # Get top 20 prominent artists
    prominent_artists = [a for a, count in artist_counts_in_genre.most_common(20)]
    
    # Filter out excluded artists for the "popularity" metric check if they are prominent
    # Actually, we want to see if the REMAINING prominent artists are popular.
    # If a genre is DOMINATED by classical artists, we might want to skip it.
    classical_count = sum(1 for a in prominent_artists if a in exclude)
    if classical_count > 5: # If more than 25% of top 20 are classical, skip
        continue
        
    avg_global_pop = sum(global_artist_counts[a] for a in prominent_artists) / len(prominent_artists)
    
    genre_popularity[genre] = {
        'avg_global_pop': avg_global_pop,
        'prominent_artists': prominent_artists[:5]
    }

sorted_genres = sorted(genre_popularity.items(), key=lambda x: x[1]['avg_global_pop'], reverse=True)

print("\nTop 10 Refined Genres with Most 'Popular' Artists:")
for i, (genre, data) in enumerate(sorted_genres[:10]):
    print(f"{i+1}. {genre} (Score: {data['avg_global_pop']:.2f})")
    print(f"   Artists: {', '.join(data['prominent_artists'])}")
