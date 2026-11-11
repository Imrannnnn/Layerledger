import urllib.request
import json
import os

uuids = [
    ('ba126346', 'ba126346-f31d-47af-86c6-571d126a9250'),
    ('ee79e7fd', 'ee79e7fd-c0b0-4a32-9b0f-1f25058c6320'),
    ('b07cb659', 'b07cb659-4089-42fa-a254-de91f6ae2715'),
    ('4649f4e3', '4649f4e3-7f76-4a99-ac22-f869e5db5a12'),
    ('d4ae948c', 'd4ae948c-7f88-436c-b930-2c98b81bf51e'),
    ('8923c10e', '8923c10e-82fc-4756-9cd5-6288d0df8ce6')
]
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

out_dir = os.path.join(os.path.dirname(__file__), 'extracted_artifacts')
os.makedirs(out_dir, exist_ok=True)

manifest = []

for short_id, u in uuids:
    url = f'https://claude.ai/api/published_artifacts/{u}'
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            title = data.get('title', 'art')
            content = data.get('content', '')
            filename = f"{short_id}_{title}"
            filepath = os.path.join(out_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[{short_id}] Title: {title}, Type: {data.get('type')}, Length: {len(content)}")
            manifest.append({
                'id': short_id,
                'uuid': u,
                'title': title,
                'type': data.get('type'),
                'description': data.get('description'),
                'filename': filename,
                'length': len(content)
            })
    except Exception as e:
        print(f"[{short_id}] Error: {e}")

with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

print("Done downloading published artifacts!")
