import json
import re

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\extracted_matches_raw.json", "r", encoding="utf-8") as f:
    raw_data = json.load(f)

for item in raw_data:
    print(f"\n====================================")
    print(f"FILE: {item['filename']}")
    print(f"====================================")
    for p_idx, page in enumerate(item['raw_pages']):
        print(f"\n--- PAGE {p_idx+1} ---")
        for line in page.split('\n'):
            line_s = line.strip()
            if line_s:
                print(line_s)
