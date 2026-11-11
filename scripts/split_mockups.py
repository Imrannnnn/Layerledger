with open('C:/Users/user/.gemini/antigravity/brain/549d6634-d3e2-4b68-892d-ca1b0839a741/current_spec.txt', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find html documents in text
splits = text.split('<!DOCTYPE html>')
print(f'Found {len(splits)} DOCTYPE sections')
if len(splits) <= 1:
    # Maybe starts with <title>
    titles = [m.start() for m in re.finditer(r'<title>', text)]
    print('Titles at:', titles)
    for i, t in enumerate(titles):
        end = text.find('</script>', t) + 9
        print(f'Mockup {i} length: {end - t}')
        with open(f'scripts/mockup_{i}.html', 'w', encoding='utf-8') as mf:
            mf.write(text[t:end])
else:
    for i, s in enumerate(splits[1:], 1):
        print(f'Section {i} length: {len(s)}')
