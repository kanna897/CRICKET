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

def parse_page4_blocks(filepath):
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
    for b_idx, block in enumerate(blocks):
        if b_idx % 2 == 0:
            inn1_blocks.append(block)
        else:
            inn2_blocks.append(block)
            
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

def build_innings_deliveries_from_blocks(inn, over_blocks):
    batters = [b for b in inn["batting"]]
    fow_map = {f["player"]: f for f in inn["fall_of_wickets"]}
    
    # Initialize striker and non-striker from batting order
    striker_name = batters[0]["name"] if len(batters) > 0 else ""
    non_striker_name = batters[1]["name"] if len(batters) > 1 else striker_name
    next_batter_idx = 2
    
    # Track retired hurt
    retired_hurt = set()
    for b in batters:
        if b["dismissal"] == "retired_hurt":
            retired_hurt.add(b["name"])
            
    deliveries = []
    
    for over_idx, b_lines in enumerate(over_blocks):
        ob = parse_over_block(b_lines)
        bowler_name = ob["bowler"]
        tokens = ob["tokens"]
        
        ball_in_over = 1
        
        for tok in tokens:
            # Handle token
            if tok == "RH":
                # Retired hurt event -> if striker is retired hurt, bring next
                if striker_name in retired_hurt:
                    if next_batter_idx < len(batters):
                        striker_name = batters[next_batter_idx]["name"]
                        next_batter_idx += 1
                elif non_striker_name in retired_hurt:
                    if next_batter_idx < len(batters):
                        non_striker_name = batters[next_batter_idx]["name"]
                        next_batter_idx += 1
                continue
                
            runs = 0
            extras = 0
            extras_type = None
            is_legal = True
            is_wicket = False
            dismissal_type = None
            player_out_name = None
            fielder_name = None
            
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
            elif tok == "+1":
                is_legal = False
                extras = 1
                extras_type = "wide"
            elif tok == "W":
                is_legal = True
                is_wicket = True
                player_out_name = striker_name
                # Find dismissal details
                b_info = next((b for b in batters if b["name"] == striker_name), None)
                if b_info:
                    dismissal_type = b_info["dismissal"]
                    fielder_name = b_info.get("fielder")
            elif tok == "1W":
                is_legal = True
                is_wicket = True
                runs = 1
                player_out_name = striker_name
                b_info = next((b for b in batters if b["name"] == striker_name), None)
                if b_info:
                    dismissal_type = b_info["dismissal"]
                    fielder_name = b_info.get("fielder")
            elif tok.isdigit():
                is_legal = True
                runs = int(tok)
            else:
                # Default fallback
                is_legal = True
                runs = 0
                
            deliv = {
                "over_number": over_idx,
                "ball_number": ball_in_over,
                "bowler_name": bowler_name,
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
            ball_in_over += 1
            
            # Wicket change
            if is_wicket:
                if next_batter_idx < len(batters):
                    striker_name = batters[next_batter_idx]["name"]
                    next_batter_idx += 1
            # Strike rotation on odd runs
            elif is_legal and (runs % 2 == 1):
                striker_name, non_striker_name = non_striker_name, striker_name
                
        # Over ends -> Rotate strike
        striker_name, non_striker_name = non_striker_name, striker_name
        
        # Check batters at end of over to keep striker & non-striker in sync with PDF
        if ob["batters_at_end"]:
            end_names = [b["name"] for b in ob["batters_at_end"]]
            if len(end_names) == 2:
                # Keep active pair
                if striker_name not in end_names and non_striker_name not in end_names:
                    striker_name = end_names[0]
                    non_striker_name = end_names[1]
                elif striker_name not in end_names:
                    striker_name = next(n for n in end_names if n != non_striker_name)
                elif non_striker_name not in end_names:
                    non_striker_name = next(n for n in end_names if n != striker_name)
                    
    return deliveries

# Test all matches
all_reconstructed = []
for f_idx, filename in enumerate(files):
    filepath = os.path.join(pdf_dir, filename)
    m = matches_info[f_idx]
    inn1_b, inn2_b = parse_page4_blocks(filepath)
    
    d1 = build_innings_deliveries_from_blocks(m["innings_1"], inn1_b)
    d2 = build_innings_deliveries_from_blocks(m["innings_2"], inn2_b)
    
    m["innings_1"]["deliveries"] = d1
    m["innings_2"]["deliveries"] = d2
    all_reconstructed.append(m)
    print(f"Match {filename}: Inn1 {len(d1)} deliveries, Inn2 {len(d2)} deliveries")

out_file = r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\exact_parsed_matches_with_balls.json"
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(all_reconstructed, f, indent=2, ensure_ascii=False)

print(f"\nSaved exact ball deliveries for all 7 matches.")
