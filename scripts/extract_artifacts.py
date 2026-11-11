import urllib.request
import json
import re
import os

urls = [
    ('artifact_1_ba126346', 'https://claude.ai/public/artifacts/ba126346-f31d-47af-86c6-571d126a9250'),
    ('artifact_2_ee79e7fd', 'https://claude.ai/public/artifacts/ee79e7fd-c0b0-4a32-9b0f-1f25058c6320'),
    ('artifact_3_b07cb659', 'https://claude.ai/public/artifacts/b07cb659-4089-42fa-a254-de91f6ae2715'),
    ('artifact_4_4649f4e3', 'https://claude.ai/public/artifacts/4649f4e3-7f76-4a99-ac22-f869e5db5a12'),
    ('artifact_5_d4ae948c', 'https://claude.ai/public/artifacts/d4ae948c-7f88-436c-b930-2c98b81bf51e'),
    ('artifact_6_8923c10e', 'https://claude.ai/public/artifacts/8923c10e-82fc-4756-9cd5-6288d0df8ce6'),
    ('artifact_7_RzjED7KU', 'https://claude.ai/artifact/RzjED7KUV2BHNn1utn9wuT')
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
out_dir = os.path.join(os.path.dirname(__file__), 'extracted_artifacts')
os.makedirs(out_dir, exist_ok=True)

for name, url in urls:
    print(f'Fetching {name} from {url}...')
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        
        # Save raw html
        with open(os.path.join(out_dir, f'{name}.html'), 'w', encoding='utf-8') as f:
            f.write(html)
            
        # Try to find Next data or json
        m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if m:
            data = json.loads(m.group(1))
            with open(os.path.join(out_dir, f'{name}_next.json'), 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            print(f'  Saved Next data for {name}')
        else:
            print(f'  No __NEXT_DATA__ found for {name}')
            
    except Exception as e:
        print(f'  Error fetching {name}: {e}')

print('Done fetching!')
