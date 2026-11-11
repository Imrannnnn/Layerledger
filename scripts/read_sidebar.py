with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(580, 650):
    print(f"{i+1}: {lines[i]}", end='')
