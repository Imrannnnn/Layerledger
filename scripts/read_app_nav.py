with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(170, 230):
    print(f"{i+1}: {lines[i]}", end='')
