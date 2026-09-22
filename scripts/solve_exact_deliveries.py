import os
import re
import json
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches_info = json.load(f)

NAME_FIXES = {
    "Gopi Krishna": "Gopikrishna",
    "Kajavathanan Nt": "Kajavathanan NT",
    "MayooranS": "Mayooran S",
    "AlthafHussain": "Althaf Hussain",
    "ZaxsanCroos": "Zaxsan Croos",
    "GopiKrishna": "Gopikrishna",
    "KajavathananNT": "Kajavathanan NT",
    "Thanaledsumy": "Thanaledsumy",
    "Ladhurshika": "Ladhurshika"
}

def clean_name(n):
    if not n: return ""
    n = re.sub(r'([a-z])([A-Z])', r'\1 \2', n)
    n = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', n)
    n = n.strip()
    return NAME_FIXES.get(n, n)

def parse_page4_blocks_smart(filepath, inn1_bowlers, inn2_bowlers):
    reader = PdfReader(filepath)
    p4 = reader.pages[3].extract_text()
    lines = [l.strip() for l in p4.split('\n') if l.strip()]
    
    filtered = []
    for l in lines:
        if "Download'STUMPS" in l or "Matchreportcreatedfrom" in l or l == "STUMPS" or l == "OverComparison" or l == "Over Comparison":
            continue
        filtered.append(l)
        
    blocks = []
    curr = []
    idx = 0
    if idx < len(filtered) and not re.search(r'Overs\s+[\d\.]+\s+Runs', filtered[idx]):
        idx += 1
        
    while idx < len(filtered):
        line = filtered[idx]
        curr.append(line)
        if re.search(r'Overs\s+[\d\.]+\s+Runs\s+\d+\s+Score\s+\d+-\d+', line):
            blocks.append(curr)
            curr = []
        idx += 1
    if curr:
        blocks.append(curr)
        
    inn1_blocks = []
    inn2_blocks = []
    
    inn1_bowler_names = set([b["name"].lower() for b in inn1_bowlers])
    inn2_bowler_names = set([b["name"].lower() for b in inn2_bowlers])
    
    for b in blocks:
        bowler = clean_name(b[-3]).lower()
        if bowler in inn1_bowler_names:
            inn1_blocks.append(b)
        elif bowler in inn2_bowler_names:
            inn2_blocks.append(b)
            
    return inn1_blocks, inn2_blocks

def parse_over_block(block_lines):
    bowler_name = clean_name(block_lines[-3])
    batters_at_end = []
    token_lines = []
    
    for l in block_lines[:-3]:
        bm = re.match(r'^(.*?)\s+(\d+)\((\d+)\)$', l)
        if bm:
            batters_at_end.append({
                "name": clean_name(bm.group(1)),
                "runs": int(bm.group(2)),
                "balls": int(bm.group(3))
            })
        else:
            token_lines.append(l)
            
    tokens_str = " ".join(token_lines).strip()
    tokens = [t.strip() for t in tokens_str.split() if t.strip()]
    return {
        "tokens": tokens,
        "batters_at_end": batters_at_end,
        "bowler": bowler_name,
        "bowler_stats": block_lines[-2],
        "summary": block_lines[-1]
    }

def decode_token(tok):
    runs = 0
    extras = 0
    extras_type = None
    is_legal = True
    is_wicket = False
    
    if tok == "Wd":
        is_legal = False
        extras = 1
        extras_type = "wide"
    elif tok == "N":
        is_legal = False
        extras = 1
        extras_type = "no_ball"
    elif tok == "1N":
        is_legal = False
        runs = 1
        extras = 1
        extras_type = "no_ball"
    elif tok == "2N":
        is_legal = False
        runs = 2
        extras = 1
        extras_type = "no_ball"
    elif tok == "4N":
        is_legal = False
        runs = 4
        extras = 1
        extras_type = "no_ball"
    elif tok == "1+Wd":
        is_legal = False
        extras = 2
        extras_type = "wide"
    elif tok == "2+Wd":
        is_legal = False
        extras = 3
        extras_type = "wide"
    elif tok == "3+Wd":
        is_legal = False
        extras = 4
        extras_type = "wide"
    elif tok == "4+Wd":
        is_legal = False
        extras = 5
        extras_type = "wide"
    elif tok == "4B":
        is_legal = True
        extras = 4
        extras_type = "bye"
    elif tok == "1B":
        is_legal = True
        extras = 1
        extras_type = "bye"
    elif tok == "2B":
        is_legal = True
        extras = 2
        extras_type = "bye"
    elif tok == "1LB":
        is_legal = True
        extras = 1
        extras_type = "leg_bye"
    elif tok == "+1":
        is_legal = False
        extras = 1
        extras_type = "wide"
    elif tok == "W":
        is_legal = True
        is_wicket = True
    elif tok == "1W":
        is_legal = True
        is_wicket = True
        runs = 1
    elif tok == "2W":
        is_legal = True
        is_wicket = True
        runs = 2
    elif tok.isdigit():
        is_legal = True
        runs = int(tok)
    else:
        is_legal = True
        runs = 0
        
    return runs, extras, extras_type, is_legal, is_wicket

def solve_over_dfs(tokens, start_striker, start_non_striker, curr_bat, target_batters_at_end, target_bat, fow_list, fow_idx, unbatted_list, bowler_name, over_num):
    target_names = [b["name"] for b in target_batters_at_end] if target_batters_at_end else []
    
    def search(tok_idx, s_name, ns_name, bat_state, cur_fow_idx, remaining_unbatted, delivs_acc):
        if tok_idx == len(tokens):
            if target_batters_at_end:
                for target in target_batters_at_end:
                    t_name = target["name"]
                    t_runs = target["runs"]
                    t_balls = target["balls"]
                    st = bat_state.get(t_name, {"runs": 0, "balls": 0})
                    if st["runs"] != t_runs or st["balls"] != t_balls:
                        return None
            return {
                "deliveries": delivs_acc,
                "end_striker": ns_name,
                "end_non_striker": s_name,
                "bat_state": bat_state,
                "fow_idx": cur_fow_idx,
                "remaining_unbatted": remaining_unbatted
            }
            
        tok = tokens[tok_idx]
        
        if tok == "RH":
            candidates = []
            if s_name and target_bat.get(s_name, {}).get("dismissal") == "retired_hurt":
                candidates.append(("striker", s_name))
            if ns_name and target_bat.get(ns_name, {}).get("dismissal") == "retired_hurt":
                candidates.append(("non_striker", ns_name))
                
            if not candidates:
                # Redundant RH event -> skip and continue
                res = search(tok_idx + 1, s_name, ns_name, bat_state, cur_fow_idx, remaining_unbatted, delivs_acc)
                if res: return res
                return None
                
            for role, name in candidates:
                new_bat_state = {k: dict(v) for k, v in bat_state.items()}
                t_info = target_bat.get(name)
                if t_info and (new_bat_state[name]["runs"] != t_info["runs"] or new_bat_state[name]["balls"] != t_info["balls"]):
                    continue
                    
                incoming = ""
                new_unbatted = list(remaining_unbatted)
                preferred = [n for n in target_names if n in remaining_unbatted and n != s_name and n != ns_name]
                if preferred:
                    incoming = preferred[0]
                    new_unbatted.remove(incoming)
                elif new_unbatted:
                    incoming = new_unbatted.pop(0)
                    
                new_s = incoming if role == "striker" else s_name
                new_ns = incoming if role == "non_striker" else ns_name
                
                res = search(tok_idx + 1, new_s, new_ns, new_bat_state, cur_fow_idx, new_unbatted, delivs_acc)
                if res: return res
            return None

        runs, extras, extras_type, is_legal, is_wicket = decode_token(tok)
        faces_ball = (is_legal or extras_type == "no_ball")
        
        striker_choices = [s_name]
        if s_name != ns_name and ns_name:
            striker_choices.append(ns_name)
            
        for choice_s in striker_choices:
            choice_ns = ns_name if choice_s == s_name else s_name
            
            cur_s_st = bat_state.get(choice_s, {"runs": 0, "balls": 0, "fours": 0, "sixes": 0})
            target_s = target_bat.get(choice_s)
            if target_s:
                if faces_ball and cur_s_st["balls"] + 1 > target_s["balls"]:
                    continue
                if runs > 0 and cur_s_st["runs"] + runs > target_s["runs"]:
                    continue
                    
            new_bat_state = {k: dict(v) for k, v in bat_state.items()}
            if choice_s not in new_bat_state:
                new_bat_state[choice_s] = {"runs": 0, "balls": 0, "fours": 0, "sixes": 0}
                
            if faces_ball:
                new_bat_state[choice_s]["balls"] += 1
            if runs > 0:
                new_bat_state[choice_s]["runs"] += runs
                if runs == 4: new_bat_state[choice_s]["fours"] += 1
                if runs == 6: new_bat_state[choice_s]["sixes"] += 1
                
            dismissal_type = None
            player_out_name = None
            fielder_name = None
            new_fow_idx = cur_fow_idx
            new_unbatted = list(remaining_unbatted)
            
            next_s = choice_s
            next_ns = choice_ns
            
            if is_wicket:
                if new_fow_idx < len(fow_list):
                    player_out_name = fow_list[new_fow_idx]["player"]
                    new_fow_idx += 1
                else:
                    player_out_name = choice_s
                    
                b_info = target_bat.get(player_out_name, {})
                dismissal_type = b_info.get("dismissal", "bowled")
                fielder_name = b_info.get("fielder")
                
                if player_out_name in new_bat_state and b_info:
                    if new_bat_state[player_out_name]["runs"] != b_info["runs"] or new_bat_state[player_out_name]["balls"] != b_info["balls"]:
                        continue
                        
                incoming = ""
                preferred = [n for n in target_names if n in new_unbatted and n != choice_s and n != choice_ns]
                if preferred:
                    incoming = preferred[0]
                    new_unbatted.remove(incoming)
                elif new_unbatted:
                    incoming = new_unbatted.pop(0)
                
                if player_out_name == choice_s:
                    next_s = incoming
                    next_ns = choice_ns
                elif player_out_name == choice_ns:
                    next_s = choice_s
                    next_ns = incoming
                else:
                    continue
            else:
                if is_legal and (runs % 2 == 1):
                    next_s, next_ns = choice_ns, choice_s
                    
            deliv = {
                "over_number": over_num,
                "ball_number": len(delivs_acc) + 1,
                "bowler_name": bowler_name,
                "batsman_name": choice_s,
                "non_striker_name": choice_ns,
                "runs": runs,
                "extras": extras,
                "extras_type": extras_type,
                "is_wicket": is_wicket,
                "is_legal": is_legal,
                "dismissal_type": dismissal_type,
                "player_out_name": player_out_name,
                "fielder_name": fielder_name
            }
            
            res = search(tok_idx + 1, next_s, next_ns, new_bat_state, new_fow_idx, new_unbatted, delivs_acc + [deliv])
            if res: return res
            
        return None

    return search(0, start_striker, start_non_striker, curr_bat, fow_idx, unbatted_list, [])

def solve_full_innings_exact(inn, over_blocks):
    batting = inn["batting"]
    fow = inn["fall_of_wickets"]
    batters_order = [b["name"] for b in batting]
    target_bat = {b["name"]: b for b in batting}
    
    curr_bat = {name: {"runs": 0, "balls": 0, "fours": 0, "sixes": 0} for name in batters_order}
    striker = batters_order[0] if len(batters_order) > 0 else ""
    non_striker = batters_order[1] if len(batters_order) > 1 else ""
    unbatted_list = [b["name"] for b in batting[2:]]
    fow_idx = 0
    
    all_delivs = []
    
    for over_idx, b_lines in enumerate(over_blocks):
        ob = parse_over_block(b_lines)
        tokens = ob["tokens"]
        target_at_end = ob["batters_at_end"]
        bowler_name = ob["bowler"]
        
        if not striker and unbatted_list:
            striker = unbatted_list.pop(0)
        if not non_striker and unbatted_list:
            non_striker = unbatted_list.pop(0)
            
        res = solve_over_dfs(
            tokens, striker, non_striker, curr_bat, target_at_end, target_bat, fow, fow_idx, unbatted_list, bowler_name, over_idx
        )
        if not res:
            res = solve_over_dfs(
                tokens, non_striker, striker, curr_bat, target_at_end, target_bat, fow, fow_idx, unbatted_list, bowler_name, over_idx
            )
        if not res:
            res = solve_over_dfs(
                tokens, striker, non_striker, curr_bat, None, target_bat, fow, fow_idx, unbatted_list, bowler_name, over_idx
            )
        if not res:
            res = solve_over_dfs(
                tokens, non_striker, striker, curr_bat, None, target_bat, fow, fow_idx, unbatted_list, bowler_name, over_idx
            )
            
        if res:
            all_delivs.extend(res["deliveries"])
            striker = res["end_striker"]
            non_striker = res["end_non_striker"]
            curr_bat = res["bat_state"]
            fow_idx = res["fow_idx"]
            unbatted_list = res["remaining_unbatted"]
        else:
            print(f"FAILED OVER {over_idx + 1}")
            
    mismatches = []
    for b in batting:
        c = curr_bat.get(b["name"], {"runs": 0, "balls": 0, "fours": 0, "sixes": 0})
        if c["runs"] != b["runs"] or c["balls"] != b["balls"] or c["fours"] != b["fours"] or c["sixes"] != b["sixes"]:
            mismatches.append(f"{b['name']}: Exp {b['runs']}({b['balls']}) [4s:{b['fours']}, 6s:{b['sixes']}] != Got {c['runs']}({c['balls']}) [4s:{c['fours']}, 6s:{c['sixes']}]")
            
    return all_delivs, mismatches

total_err = 0
all_solved_matches = []

for f_idx, filename in enumerate(files):
    filepath = os.path.join(pdf_dir, filename)
    m = matches_info[f_idx]
    inn1_b, inn2_b = parse_page4_blocks_smart(
        filepath,
        m["innings_1"]["bowling"],
        m["innings_2"]["bowling"]
    )
    
    d1, err1 = solve_full_innings_exact(m["innings_1"], inn1_b)
    d2, err2 = solve_full_innings_exact(m["innings_2"], inn2_b)
    
    m["innings_1"]["deliveries"] = d1
    m["innings_2"]["deliveries"] = d2
    all_solved_matches.append(m)
    
    print(f"\n--- {filename} ({m['team_a']} vs {m['team_b']}) ---")
    if err1:
        print(f"  Inn1 Errors ({len(err1)}):")
        for e in err1: print(f"    {e}")
        total_err += len(err1)
    else:
        print(f"  Inn1: 100% PERFECT MATCH ({len(d1)} balls)!")
        
    if err2:
        print(f"  Inn2 Errors ({len(err2)}):")
        for e in err2: print(f"    {e}")
        total_err += len(err2)
    else:
        print(f"  Inn2: 100% PERFECT MATCH ({len(d2)} balls)!")

print(f"\n=======================================================")
print(f"TOTAL MISMATCHES ACROSS ALL 7 MATCHES: {total_err}")
print(f"=======================================================")

if total_err == 0:
    out_file = r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\exact_parsed_matches_with_balls.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_solved_matches, f, indent=2, ensure_ascii=False)
    print(f"SUCCESSFULLY SAVED ALL 7 PERFECT MATCHES TO: {out_file}")
