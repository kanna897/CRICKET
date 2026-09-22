import json

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches = json.load(f)

for m in matches:
    for inn_key in ["innings_1", "innings_2"]:
        inn = m[inn_key]
        for b in inn["batting"]:
            if "iraj" in b["name"] or b["name"] == "A" or "iraj" in str(b.get("bowler")) or "iraj" in str(b.get("fielder")):
                print(f"Match {m['filename']} {inn_key} batting:", b)
        for b in inn["bowling"]:
            if "iraj" in b["name"] or b["name"] == "A":
                print(f"Match {m['filename']} {inn_key} bowling:", b)
