import kagglehub
import pandas as pd
import os

# Download the latest version
path = kagglehub.dataset_download("nikitricky/every-noise-at-once")

print(f"Dataset downloaded to: {path}")
files = os.listdir(path)
print(f"Files in dataset: {files}")

for file in files:
    if file.endswith('.csv'):
        file_path = os.path.join(path, file)
        df = pd.read_csv(file_path, nrows=5)
        print(f"\nColumns in {file}:")
        print(df.columns.tolist())
        print("\nSample row:")
        print(df.iloc[0].to_dict())
