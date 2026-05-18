import pandas as pd
import glob
import xlrd

files = glob.glob('*.xls')
if files:
    try:
        book = xlrd.open_workbook(files[0], encoding_override='cp949')
        df = pd.read_excel(book)
        cols = df.columns.tolist()
        print("Columns:", cols[:10])
        print("Author:", df.iloc[0, 2])
    except Exception as e:
        print("Failed:", e)
