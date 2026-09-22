import json

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches = json.load(f)

for m in matches:
    print(f"\n==========================================")
    print(f"MATCH: {m['filename']} - {m['team_a']} vs {m['team_b']}")
    print(f"==========================================")
    for l in m['over_comparison_raw'][:40]:
        print(l)
