import pathlib, pandas as pd
DATA = pathlib.Path(__file__).parent / 'data'
for name in ['DataCoSupplyChainDataset.csv', 'food_delivery.csv']:
    path = DATA / name
    if not path.exists():
        print('MISSING:', path)
        continue
    df = pd.read_csv(path, nrows=3, encoding='latin-1')
    print('FILE:', name)
    print('COLUMNS:', list(df.columns))
    print('SAMPLE:', df.iloc[0].to_dict())
