import json
import re

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches = json.load(f)

def generate_innings_deliveries(inn, batting_team, bowling_team):
    """
    Synthesize the ball_by_ball list for an innings based on:
    - inn["batting"] (runs, balls, 4s, 6s, dismissal, bowler, fielder)
    - inn["bowling"] (overs, maidens, runs, wickets, wides, no_balls, etc.)
    - inn["fall_of_wickets"] (score, wicket_number, player, over)
    - inn["extras"] (wides, no_balls, byes, leg_byes, total)
    """
    batters = [b for b in inn["batting"]]
    bowlers = [b for b in inn["bowling"]]
    fow = {f["player"]: f for f in inn["fall_of_wickets"]}
    
    # We create 8 overs (or actual overs bowled, e.g. 5.0, 7.2, 8.0)
    total_overs = inn["overs"]
    full_overs = int(total_overs)
    remainder_balls = int(round((total_overs - full_overs) * 10))
    
    # Build a timeline of balls per bowler
    # Bowlers bowl in the order they appear in the bowling scorecard
    bowler_queue = []
    for b in bowlers:
        b_ov = b["overs"]
        b_full = int(b_ov)
        b_rem = int(round((b_ov - b_full) * 10))
        for _ in range(b_full):
            bowler_queue.append((b, 6))
        if b_rem > 0:
            bowler_queue.append((b, b_rem))
            
    # Track batters at crease
    striker_idx = 0
    non_striker_idx = 1 if len(batters) > 1 else 0
    next_batter_idx = 2
    
    # Batter tracking for runs remaining, 4s, 6s, balls remaining
    batter_state = {}
    for b in batters:
        batter_state[b["name"]] = {
            "name": b["name"],
            "runs_left": b["runs"],
            "balls_left": b["balls"],
            "fours_left": b["fours"],
            "sixes_left": b["sixes"],
            "dismissal": b["dismissal"],
            "bowler": b.get("bowler"),
            "fielder": b.get("fielder"),
            "is_out": b["is_out"],
            "runs_scored": 0,
            "balls_faced": 0
        }
        
    deliveries = []
    ball_id_counter = 1
    
    # Process over by over
    for over_idx, (bowler_info, max_legal_balls) in enumerate(bowler_queue):
        legal_balls_in_over = 0
        ball_in_over_num = 1
        
        # Bowler quotas
        bowler_wides_left = bowler_info["wides"]
        bowler_nb_left = bowler_info["no_balls"]
        bowler_wkts_left = bowler_info["wickets"]
        
        while legal_balls_in_over < max_legal_balls:
            # Current striker
            if striker_idx >= len(batters):
                break
            striker_name = batters[striker_idx]["name"]
            st_state = batter_state[striker_name]
            
            non_striker_name = batters[non_striker_idx]["name"] if non_striker_idx < len(batters) else striker_name
            
            # Decide if wide, no_ball, wicket, or normal run
            is_wide = False
            is_nb = False
            is_wicket = False
            runs = 0
            extras = 0
            extras_type = None
            is_legal = True
            dismissal_type = None
            player_out_name = None
            fielder_name = None
            
            # Check if bowler has wide to bowl
            if bowler_wides_left > 0 and (ball_in_over_num == 1 or bowler_wides_left >= (max_legal_balls - legal_balls_in_over)):
                is_wide = True
                is_legal = False
                extras = 1
                extras_type = "wide"
                bowler_wides_left -= 1
            elif bowler_nb_left > 0 and (ball_in_over_num == 2 or bowler_nb_left >= (max_legal_balls - legal_balls_in_over)):
                is_nb = True
                is_legal = False
                extras = 1
                extras_type = "no_ball"
                bowler_nb_left -= 1
            else:
                # Legal delivery
                is_legal = True
                legal_balls_in_over += 1
                
                # Check if this batter is out on this ball (e.g. if balls_left == 1 and is_out)
                if st_state["balls_left"] == 1 and st_state["is_out"]:
                    is_wicket = True
                    dismissal_type = st_state["dismissal"]
                    player_out_name = striker_name
                    fielder_name = st_state["fielder"]
                    runs = st_state["runs_left"] # any runs on the wicket ball
                    st_state["runs_left"] = 0
                    st_state["balls_left"] = 0
                    st_state["balls_faced"] += 1
                    st_state["runs_scored"] += runs
                else:
                    # Score boundary or singles
                    if st_state["sixes_left"] > 0 and st_state["runs_left"] >= 6:
                        runs = 6
                        st_state["sixes_left"] -= 1
                        st_state["runs_left"] -= 6
                    elif st_state["fours_left"] > 0 and st_state["runs_left"] >= 4:
                        runs = 4
                        st_state["fours_left"] -= 1
                        st_state["runs_left"] -= 4
                    elif st_state["runs_left"] > 0:
                        runs = min(st_state["runs_left"], 2 if st_state["runs_left"] > 1 and st_state["balls_left"] <= 2 else 1)
                        st_state["runs_left"] -= runs
                    else:
                        runs = 0
                        
                    st_state["balls_left"] = max(0, st_state["balls_left"] - 1)
                    st_state["balls_faced"] += 1
                    st_state["runs_scored"] += runs
                    
            deliv = {
                "over_number": over_idx,
                "ball_number": ball_in_over_num,
                "bowler_name": bowler_info["name"],
                "batsman_name": striker_name,
                "non_striker_name": non_striker_name,
                "runs": runs,
                "extras": extras,
                "extras_type": extras_type,
                "is_wicket": is_wicket,
                "is_legal": is_legal,
                "dismissal_type": dismissal_type,
                "player_out_name": player_out_name,
                "fielder_name": fielder_name
            }
            deliveries.append(deliv)
            ball_in_over_num += 1
            
            # If wicket fell, next batter comes in
            if is_wicket:
                striker_idx = next_batter_idx
                next_batter_idx += 1
            # If odd runs scored on legal ball, rotate strike
            elif is_legal and (runs % 2 == 1):
                striker_idx, non_striker_idx = non_striker_idx, striker_idx
                
        # Over finished -> rotate strike
        striker_idx, non_striker_idx = non_striker_idx, striker_idx
        
    return deliveries

# Verify all matches
total_balls_generated = 0
for m in matches:
    delivs1 = generate_innings_deliveries(m["innings_1"], m["team_a"], m["team_b"])
    delivs2 = generate_innings_deliveries(m["innings_2"], m["team_b"], m["team_a"])
    m["innings_1"]["deliveries"] = delivs1
    m["innings_2"]["deliveries"] = delivs2
    total_balls_generated += len(delivs1) + len(delivs2)
    print(f"Match {m['filename']}: Inn1 {len(delivs1)} deliveries, Inn2 {len(delivs2)} deliveries")

print(f"\nTotal deliveries generated across all 7 matches: {total_balls_generated}")
with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\matches_with_deliveries.json", "w", encoding="utf-8") as f:
    json.dump(matches, f, indent=2, ensure_ascii=False)
