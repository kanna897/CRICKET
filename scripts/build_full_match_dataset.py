import json
import re

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches = json.load(f)

# Collect all teams and players across all matches
teams_players = {}

for m in matches:
    t_a = m["team_a"]
    t_b = m["team_b"]
    if t_a not in teams_players: teams_players[t_a] = set()
    if t_b not in teams_players: teams_players[t_b] = set()
    
    # Batting team players
    for b in m["innings_1"]["batting"]:
        teams_players[t_a].add(b["name"])
    for b in m["innings_2"]["batting"]:
        teams_players[t_b].add(b["name"])
        
    # Bowling team players
    for b in m["innings_1"]["bowling"]:
        teams_players[t_b].add(b["name"])
    for b in m["innings_2"]["bowling"]:
        teams_players[t_a].add(b["name"])
        
    # FOW fielders/bowlers
    for b in m["innings_1"]["batting"]:
        if b.get("bowler"): teams_players[t_b].add(b["bowler"])
        if b.get("fielder"): teams_players[t_b].add(b["fielder"])
    for b in m["innings_2"]["batting"]:
        if b.get("bowler"): teams_players[t_a].add(b["bowler"])
        if b.get("fielder"): teams_players[t_a].add(b["fielder"])

print("--- Discovered Teams & Players ---")
for t, p_set in teams_players.items():
    print(f"\nTEAM: {t} ({len(p_set)} players)")
    print(", ".join(sorted(p_set)))
