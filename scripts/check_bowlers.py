from solve_exact_deliveries import parse_page4_blocks_smart, parse_over_block
import json

matches_info = json.load(open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", encoding="utf-8"))

m2 = matches_info[2]
_, inn2_b = parse_page4_blocks_smart(r"C:\Users\Mr.Cherry\Downloads\attachments\2.pdf", m2["innings_1"]["bowling"], m2["innings_2"]["bowling"])
print("Match 2 Inn2 Bowlers from Page 4:")
for i, b in enumerate(inn2_b):
    ob = parse_over_block(b)
    print("Over", i+1, ":", ob["bowler"], ", stats:", ob["bowler_stats"], ", summary:", ob["summary"])

print("\nMatch 2 Inn2 Bowling Scorecard in PDF:")
for b in m2["innings_2"]["bowling"]:
    print(b["name"], ":", b["overs"], "ov,", b["runs"], "r,", b["wickets"], "w")

# Match 6
m6 = matches_info[6]
inn1_b, _ = parse_page4_blocks_smart(r"C:\Users\Mr.Cherry\Downloads\attachments\6.pdf", m6["innings_1"]["bowling"], m6["innings_2"]["bowling"])
print("\nMatch 6 Inn1 Bowlers from Page 4:")
for i, b in enumerate(inn1_b):
    ob = parse_over_block(b)
    print("Over", i+1, ":", ob["bowler"], ", stats:", ob["bowler_stats"], ", summary:", ob["summary"])

print("\nMatch 6 Inn1 Bowling Scorecard in PDF:")
for b in m6["innings_1"]["bowling"]:
    print(b["name"], ":", b["overs"], "ov,", b["runs"], "r,", b["wickets"], "w")
