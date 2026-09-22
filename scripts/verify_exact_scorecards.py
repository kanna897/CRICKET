import json

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\exact_parsed_matches_with_balls.json", "r", encoding="utf-8") as f:
    matches = json.load(f)

total_mismatches = 0

for m in matches:
    print(f"\n=================================================================")
    print(f"VERIFYING MATCH {m['filename']}: {m['team_a']} vs {m['team_b']}")
    print(f"=================================================================")
    
    for inn_key in ["innings_1", "innings_2"]:
        inn = m[inn_key]
        deliveries = inn["deliveries"]
        
        # Calculate batting stats from deliveries
        bat_stats = {}
        for b in inn["batting"]:
            bat_stats[b["name"]] = {"runs": 0, "balls": 0, "fours": 0, "sixes": 0}
            
        for d in deliveries:
            b_name = d["batsman_name"]
            if b_name in bat_stats:
                if d["is_legal"] or d.get("extras_type") == "no_ball":
                    bat_stats[b_name]["balls"] += 1
                bat_stats[b_name]["runs"] += d["runs"]
                if d["runs"] == 4: bat_stats[b_name]["fours"] += 1
                if d["runs"] == 6: bat_stats[b_name]["sixes"] += 1
                
        # Compare Batting
        print(f"\n  Innings {inn_key} ({inn['team_name']}) Batting:")
        for b in inn["batting"]:
            calc = bat_stats.get(b["name"], {"runs": 0, "balls": 0, "fours": 0, "sixes": 0})
            is_match = (calc["runs"] == b["runs"] and calc["balls"] == b["balls"] and calc["fours"] == b["fours"] and calc["sixes"] == b["sixes"])
            status = "[OK]" if is_match else "[MISMATCH]"
            if not is_match:
                total_mismatches += 1
                print(f"    {status} {b['name']}: Expected {b['runs']}({b['balls']}) [4s:{b['fours']}, 6s:{b['sixes']}] | Got {calc['runs']}({calc['balls']}) [4s:{calc['fours']}, 6s:{calc['sixes']}]")
            else:
                print(f"    {status} {b['name']}: {calc['runs']}({calc['balls']}) [4s:{calc['fours']}, 6s:{calc['sixes']}]")

        # Compare Bowling
        bw_stats = {}
        for b in inn["bowling"]:
            bw_stats[b["name"]] = {"overs_balls": 0, "runs": 0, "wickets": 0, "wides": 0, "no_balls": 0}
            
        for d in deliveries:
            bw_name = d["bowler_name"]
            if bw_name not in bw_stats:
                bw_stats[bw_name] = {"overs_balls": 0, "runs": 0, "wickets": 0, "wides": 0, "no_balls": 0}
            if d["is_legal"]:
                bw_stats[bw_name]["overs_balls"] += 1
            bw_stats[bw_name]["runs"] += d["runs"] + d["extras"]
            if d["is_wicket"] and d["dismissal_type"] != "run_out":
                bw_stats[bw_name]["wickets"] += 1
            if d["extras_type"] == "wide":
                bw_stats[bw_name]["wides"] += 1
            if d["extras_type"] == "no_ball":
                bw_stats[bw_name]["no_balls"] += 1

        print(f"\n  Innings {inn_key} ({inn['team_name']}) Bowling:")
        for b in inn["bowling"]:
            calc = bw_stats.get(b["name"], {"overs_balls": 0, "runs": 0, "wickets": 0, "wides": 0, "no_balls": 0})
            is_match = (calc["wickets"] == b["wickets"] and calc["runs"] == b["runs"])
            status = "[OK]" if is_match else "[DIFF]"
            if not is_match:
                print(f"    {status} {b['name']}: Expected {b['wickets']}w, {b['runs']}r in {b['overs']}ov | Got {calc['wickets']}w, {calc['runs']}r in {calc['overs_balls']}b")
            else:
                print(f"    {status} {b['name']}: {calc['wickets']}w, {calc['runs']}r ({b['overs']} ov)")

print(f"\n=================================================================")
print(f"TOTAL BATTING MISMATCHES: {total_mismatches}")
print(f"=================================================================")
