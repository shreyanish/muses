import pandas as pd
import json
import os
import numpy as np
from scipy.spatial import KDTree
import ast

def process_csv(genres_csv, songs_csv, output_path):
    print(f"Loading {genres_csv}...")
    genres_df = pd.read_csv(genres_csv)
    
    print(f"Loading {songs_csv} for aggregation...")
    # Load only necessary columns to save memory
    cols_to_load = ['Genre', 'Artists', 'Danceability', 'Energy', 'Acousticness', 'Instrumentalness', 'Valeance', 'Tempo', 'Loudness', 'Speechiness']
    songs_df = pd.read_csv(songs_csv, usecols=cols_to_load)
    
    # Process songs to get top artists and average features per genre
    print("Aggregating genre data...")
    
    # Pre-process Artists column (it's a string representation of a list)
    def parse_artists(x):
        try:
            return ast.literal_eval(x)
        except:
            return []

    # Simple aggregation for numerical features
    genre_features = songs_df.groupby('Genre').agg({
        'Danceability': 'mean',
        'Energy': 'mean',
        'Acousticness': 'mean',
        'Instrumentalness': 'mean',
        'Valeance': 'mean',
        'Tempo': 'mean',
        'Loudness': 'mean',
        'Speechiness': 'mean'
    }).reset_index()

    # Get top artists per genre
    print("Extracting top artists per genre...")
    genre_artists = {}
    for genre, group in songs_df.groupby('Genre'):
        all_artists = []
        for artists_list_str in group['Artists']:
            all_artists.extend(parse_artists(artists_list_str))
        
        # Count occurrences and get top 20
        artist_counts = pd.Series(all_artists).value_counts()
        genre_artists[genre] = artist_counts.head(20).index.tolist()

    # Drop missing values in genres_df
    genres_df = genres_df.dropna(subset=['genre', 'x', 'y', 'hex_colour'])
    
    # Normalize coordinates
    min_x, max_x = genres_df['x'].min(), genres_df['x'].max()
    min_y, max_y = genres_df['y'].min(), genres_df['y'].max()
    
    genres_df['x_norm'] = (genres_df['x'] - min_x) / (max_x - min_x) * 1000
    genres_df['y_norm'] = (genres_df['y'] - min_y) / (max_y - min_y) * 1000

    # Merge features and artists into nodes
    nodes = []
    coords = []
    for _, row in genres_df.iterrows():
        genre_name = row['genre']
        
        # Get features
        features = {}
        feat_match = genre_features[genre_features['Genre'] == genre_name]
        if not feat_match.empty:
            features = feat_match.iloc[0].drop('Genre').to_dict()
            # Rename Valeance to Valence
            if 'Valeance' in features:
                features['Valence'] = features.pop('Valeance')
        
        # Get artists
        artists = genre_artists.get(genre_name, [])

        nodes.append({
            'id': genre_name,
            'x': float(row['x_norm']),
            'y': float(row['y_norm']),
            'c': row['hex_colour'],
            'topArtists': artists,
            'features': features
        })
        coords.append([float(row['x_norm']), float(row['y_norm'])])
    
    # KNN Links
    print("Calculating links using KNN...")
    coords = np.array(coords)
    tree = KDTree(coords)
    links = []
    for i in range(len(nodes)):
        distances, indices = tree.query(coords[i], k=4)
        for j in range(1, len(indices)):
            target_idx = indices[j]
            links.append({
                'source': nodes[i]['id'],
                'target': nodes[target_idx]['id'],
                'value': float(1 / (distances[j] + 1))
            })
    
    graph_data = {
        'nodes': nodes,
        'links': links
    }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    print(f"Saving {len(nodes)} nodes and {len(links)} links to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(graph_data, f)

if __name__ == "__main__":
    songs_csv_path = "/Users/shreyanish/.cache/kagglehub/datasets/nikitricky/every-noise-at-once/versions/2/songs.csv"
    process_csv("genres.csv", songs_csv_path, "public/genres.json")
