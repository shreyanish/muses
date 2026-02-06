import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd

# Load the latest version
df = kagglehub.load_dataset(
  KaggleDatasetAdapter.PANDAS,
  "nikitricky/every-noise-at-once",
  "data.csv",
)

print("Columns:", df.columns.tolist())
print("\nFirst 5 records:\n", df.head())
print("\nShape:", df.shape)
