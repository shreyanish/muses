import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def plot_genres(csv_path, output_path):
    print(f"Reading data from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Clean data: drop rows with missing coordinates or color
    df = df.dropna(subset=['x', 'y', 'hex_colour'])

    print(f"Plotting {len(df)} genres...")
    
    # Use dark theme for premium feel
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(20, 12), dpi=150)
    
    # Scatter plot with actual genre colors
    # We use a loop or vectorized approach to apply hex colors
    scatter = ax.scatter(
        df['x'], 
        df['y'], 
        c=df['hex_colour'], 
        alpha=0.6, 
        s=10, 
        edgecolors='none'
    )

    # Add labels for a subset of genres to avoid clutter
    # We'll pick about 200 random genres + some common ones if possible
    # For now, let's just pick every Nth genre
    num_labels = 150
    step = max(1, len(df) // num_labels)
    labeled_df = df.iloc[::step]

    for i, row in labeled_df.iterrows():
        ax.text(
            row['x'], 
            row['y'], 
            row['genre'], 
            fontsize=6, 
            color='white', 
            alpha=0.8,
            ha='center',
            va='center',
            clip_on=True
        )

    ax.set_title("Spotify Genre Map (Every Noise at Once)", fontsize=20, pad=20, color='white')
    ax.set_xlabel("Dimension X", fontsize=12, color='gray')
    ax.set_ylabel("Dimension Y", fontsize=12, color='gray')
    
    # Remove axis for a cleaner map look
    # ax.axis('off')
    
    plt.tight_layout()
    plt.savefig(output_path, bbox_inches='tight', facecolor='black')
    print(f"Visualization saved to {output_path}")

if __name__ == "__main__":
    plot_genres("genres.csv", "spotify_genres_map.png")
