import kagglehub
import os
import pandas as pd

path = kagglehub.dataset_download('nikitricky/every-noise-at-once')
print(f"Dataset path: {path}")

for f in os.listdir(path):
    full_path = os.path.join(path, f)
    if os.path.isfile(full_path) and f.endswith('.csv'):
        try:
            df = pd.read_csv(full_path, nrows=0)
            print(f"{f}: {df.columns.tolist()}")
            
            # Check for popularity in columns
            cols = [c.lower() for c in df.columns]
            if 'popularity' in cols:
                print(f"  -> Found 'popularity' in {f}!")
                # Get a sample
                df_sample = pd.read_csv(full_path, nrows=5)
                print(df_sample[['Genre', 'Artists', 'Popularity']] if 'Popularity' in df_sample.columns else "Popularity column case mismatch")
        except Exception as e:
            print(f"Error reading {f}: {e}")
