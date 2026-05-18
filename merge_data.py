import pandas as pd
import glob
import re

files = glob.glob('KCI_excel_*.xls')
print(f"Found {len(files)} files")
dfs = []
for file in files:
    try:
        df = pd.read_excel(file)
        # Add a column indicating source file
        df['source_file'] = file
        dfs.append(df)
        print(f"Read {file} successfully.")
    except Exception as e:
        print(f"Error reading {file}: {e}")

if dfs:
    merged_df = pd.concat(dfs, ignore_index=True)
    
    # Save as CSV
    csv_file = 'merged_kci_data.csv'
    merged_df.to_csv(csv_file, index=False, encoding='utf-8-sig')
    
    # Clean illegal characters for Excel
    merged_df = merged_df.replace(r'[\000-\010]|[\013-\014]|[\016-\037]', '', regex=True)
    
    # Save as Excel
    excel_file = 'merged_kci_data.xlsx'
    try:
        merged_df.to_excel(excel_file, index=False)
        print(f"Merged data saved to {csv_file} and {excel_file} with shape {merged_df.shape}")
    except Exception as e:
        print(f"Failed to save to Excel: {e}")
        print(f"Merged data saved to {csv_file} with shape {merged_df.shape}")
else:
    print("No data to merge.")
