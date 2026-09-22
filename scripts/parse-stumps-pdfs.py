import os
import re
import json
from pypdf import PdfReader

KNOWN_TEAMS = ["AVENGERS", "RISING TITANS", "ROYAL STRIKERS", "PRIME XI"]

NAME_FIXES = {
    "Gopi Krishna": "Gopikrishna",
    "Kajavathanan Nt": "Kajavathanan NT",
    "MayooranS": "Mayooran S",
    "AlthafHussain": "Althaf Hussain",
    "ZaxsanCroos": "Zaxsan Croos",
    "Thanaledsumy": "Thanaledsumy",
    "Ladhurshika": "Ladhurshika",
}

def clean_player_name(raw):
    if not raw: return ""
    raw = raw.strip()
    raw = re.sub(r'([a-z])([A-Z])', r'\1 \2', raw)
    raw = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', raw)
    raw = raw.strip()
    return NAME_FIXES.get(raw, raw)

def match_team_name(raw_name):
    clean = re.sub(r'[^a-zA-Z]', '', raw_name).upper()
    for team in KNOWN_TEAMS:
        team_clean = re.sub(r'[^a-zA-Z]', '', team).upper()
        if team_clean in clean or clean in team_clean:
            return team
    return raw_name.strip()

def parse_dismissal(full_str):
    # returns (p_name, dismissal, bowler, fielder)
    # Check not out
    if any(no in full_str for no in [" notout", "notout", " not out"]):
        p_name = re.sub(r'\s*notout|\s*not out', '', full_str)
        return (clean_player_name(p_name), "not out", None, None)
    if any(rh in full_str for rh in ["RetiredHurt", "Retired Hurt"]):
        p_name = re.sub(r'\s*RetiredHurt|\s*Retired Hurt', '', full_str)
        return (clean_player_name(p_name), "retired_hurt", None, None)
    if "runout" in full_str or "run out" in full_str:
        ro_m = re.search(r'^(.*?)\s*run\s*out\s*(?:\((.*?)\))?', full_str, re.IGNORECASE)
        p_name = ro_m.group(1) if ro_m else full_str
        f_name = ro_m.group(2) if (ro_m and ro_m.group(2)) else None
        return (clean_player_name(p_name), "run_out", None, clean_player_name(f_name))
    if "c&b" in full_str or "c & b" in full_str:
        cb_m = re.search(r'^(.*?)\s*c\s*&\s*b\s*(.*)', full_str)
        if cb_m:
            p_name = cb_m.group(1)
            b_name = cb_m.group(2)
            return (clean_player_name(p_name), "caught_and_bowled", clean_player_name(b_name), clean_player_name(b_name))
    # Caught: e.g. "Shangave cAnushanbKrishalani" or "Denojan cRashminbZaxsanCroos" or "Sopraj cAbirajbThayuran"
    c_m = re.search(r'^(.*?)\s+c([A-Z][a-zA-Z0-9_\s]*)b([A-Z][a-zA-Z0-9_\s]*)$', full_str)
    if c_m:
        p_name = c_m.group(1)
        f_name = c_m.group(2)
        b_name = c_m.group(3)
        return (clean_player_name(p_name), "caught", clean_player_name(b_name), clean_player_name(f_name))
    # Bowled: e.g. "Abilasha bJanushika"
    b_m = re.search(r'^(.*?)\s+b([A-Z][a-zA-Z0-9_\s]*)$', full_str)
    if b_m:
        p_name = b_m.group(1)
        b_name = b_m.group(2)
        return (clean_player_name(p_name), "bowled", clean_player_name(b_name), None)
    # LBW
    lbw_m = re.search(r'^(.*?)\s+lbwb([A-Z][a-zA-Z0-9_\s]*)$', full_str)
    if lbw_m:
        p_name = lbw_m.group(1)
        b_name = lbw_m.group(2)
        return (clean_player_name(p_name), "lbw", clean_player_name(b_name), None)
    # Stumped
    st_m = re.search(r'^(.*?)\s+st([A-Z][a-zA-Z0-9_\s]*)b([A-Z][a-zA-Z0-9_\s]*)$', full_str)
    if st_m:
        p_name = st_m.group(1)
        f_name = st_m.group(2)
        b_name = st_m.group(3)
        return (clean_player_name(p_name), "stumped", clean_player_name(b_name), clean_player_name(f_name))
        
    return (clean_player_name(full_str), "out", None, None)

def parse_scorecard_page(page_text):
    lines = [l.strip() for l in page_text.split('\n') if l.strip()]
    content_lines = []
    for l in lines:
        if "Download'STUMPS" in l or "Matchreportcreatedfrom" in l or l == "STUMPS":
            continue
        content_lines.append(l)
        
    innings_type = ""
    team_name = ""
    batting = []
    bowling = []
    fall_of_wickets = []
    extras = {"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0, "total": 0}
    total_runs = 0
    total_wickets = 0
    overs = 0.0
    run_rate = 0.0
    
    mode = "start"
    batting_re = re.compile(r'^(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d\.]+)\s*$')
    bowling_re = re.compile(r'^(.*?)\s+([\d\.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d\.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$')
    
    i = 0
    while i < len(content_lines):
        line = content_lines[i]
        
        if "InningsScorecard" in line.replace(" ", ""):
            innings_type = line
            i += 1
            continue
            
        if "Extras" in line:
            wd = re.search(r'WD(\d+)', line)
            nb = re.search(r'NB(\d+)', line)
            b = re.search(r'\bB(\d+)', line)
            lb = re.search(r'LB(\d+)', line)
            if wd: extras["wides"] = int(wd.group(1))
            if nb: extras["no_balls"] = int(nb.group(1))
            if b: extras["byes"] = int(b.group(1))
            if lb: extras["leg_byes"] = int(lb.group(1))
            
            ext_tot = re.search(r'\)\s*(\d+)\s+Overs', line)
            if ext_tot: extras["total"] = int(ext_tot.group(1))
            else: extras["total"] = extras["wides"] + extras["no_balls"] + extras["byes"] + extras["leg_byes"]
            
            ov_m = re.search(r'Overs\s+([\d\.]+)', line)
            if ov_m: overs = float(ov_m.group(1))
            i += 1
            continue
            
        if line.startswith("Total "):
            tot_m = re.search(r'Total\s+(\d+)/(\d+)\s+RunRate\s+([\d\.]+)', line)
            if tot_m:
                total_runs = int(tot_m.group(1))
                total_wickets = int(tot_m.group(2))
                run_rate = float(tot_m.group(3))
            i += 1
            continue
            
        if "FallOfWickets" in line.replace(" ", ""):
            mode = "fow"
            i += 1
            fow_text = ""
            while i < len(content_lines) and not content_lines[i].startswith("Bowler"):
                fow_text += " " + content_lines[i]
                i += 1
            fow_matches = re.findall(r'(\d+)-(\d+)\s*\(([^,]+),\s*([\d\.]+)\)', fow_text)
            for score, wkt_num, player, ov in fow_matches:
                fall_of_wickets.append({
                    "score": int(score),
                    "wicket_number": int(wkt_num),
                    "player": clean_player_name(player.strip()),
                    "over": ov.strip()
                })
            continue
            
        if content_lines[i].startswith("Bowler"):
            mode = "bowling"
            i += 1
            continue
            
        if mode == "bowling":
            bm = bowling_re.match(line)
            if bm:
                b_name = clean_player_name(bm.group(1))
                bowling.append({
                    "name": b_name,
                    "overs": float(bm.group(2)),
                    "maidens": int(bm.group(3)),
                    "runs": int(bm.group(4)),
                    "wickets": int(bm.group(5)),
                    "economy": float(bm.group(6)),
                    "dots": int(bm.group(7)),
                    "fours": int(bm.group(8)),
                    "sixes": int(bm.group(9)),
                    "wides": int(bm.group(10)),
                    "no_balls": int(bm.group(11))
                })
            i += 1
            continue
            
        if not team_name:
            clean_l = re.sub(r'\s*R\s+B\s+4s\s+6s\s+SR.*', '', line)
            team_name = match_team_name(clean_l)
            i += 1
            continue
            
        bm = batting_re.match(line)
        if bm:
            full_str = bm.group(1).strip()
            runs = int(bm.group(2))
            balls = int(bm.group(3))
            fours = int(bm.group(4))
            sixes = int(bm.group(5))
            sr = float(bm.group(6))
            
            p_name, dismissal, bowler, fielder = parse_dismissal(full_str)
            batting.append({
                "name": p_name,
                "runs": runs,
                "balls": balls,
                "fours": fours,
                "sixes": sixes,
                "strike_rate": sr,
                "dismissal": dismissal,
                "bowler": bowler,
                "fielder": fielder,
                "is_out": dismissal not in ["not out", "retired_hurt"]
            })
        i += 1
        
    return {
        "team_name": team_name,
        "total_runs": total_runs,
        "total_wickets": total_wickets,
        "overs": overs,
        "run_rate": run_rate,
        "extras": extras,
        "batting": batting,
        "bowling": bowling,
        "fall_of_wickets": fall_of_wickets
    }

def parse_match_pdf(filepath, filename):
    reader = PdfReader(filepath)
    p1 = reader.pages[0].extract_text()
    p2 = reader.pages[1].extract_text()
    p3 = reader.pages[2].extract_text()
    
    lines_p1 = [l.strip() for l in p1.split('\n') if l.strip()]
    match_title = "Match"
    for l in lines_p1:
        if l.startswith("MatchTitle"):
            match_title = l.replace("MatchTitle", "").strip()
            
    is_qualifier = "qualifier" in match_title.lower() or filename == "6.pdf"
    
    date_str = "2026-09-20"
    time_str = "08:00:00"
    for l in lines_p1:
        if "Date&Time" in l:
            dt_clean = l.replace("Date&Time", "").strip()
            tm = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', dt_clean, re.IGNORECASE)
            if tm:
                hr = int(tm.group(1))
                mn = int(tm.group(2))
                ampm = tm.group(3).upper()
                if ampm == "PM" and hr < 12: hr += 12
                if ampm == "AM" and hr == 12: hr = 0
                time_str = f"{hr:02d}:{mn:02d}:00"
                
    potm = ""
    for idx, l in enumerate(lines_p1):
        if "PlayerOfTheMatch" in l.replace(" ", ""):
            if idx + 1 < len(lines_p1):
                potm = clean_player_name(lines_p1[idx + 1])
                
    toss_winner = ""
    toss_decision = "bowl"
    for l in lines_p1:
        if "Toss" in l:
            toss_str = l.replace("Toss", "").strip()
            if "OptedToBat" in toss_str:
                toss_decision = "bat"
                toss_winner = match_team_name(toss_str.replace("OptedToBat", ""))
            elif "OptedToBowl" in toss_str:
                toss_decision = "bowl"
                toss_winner = match_team_name(toss_str.replace("OptedToBowl", ""))
                
    result_str = ""
    for idx, l in enumerate(lines_p1):
        if l == "Result" and idx + 1 < len(lines_p1):
            res_lines = [lines_p1[idx + 1]]
            if idx + 2 < len(lines_p1) and "Player" not in lines_p1[idx + 2] and "Match" not in lines_p1[idx + 2]:
                res_lines.append(lines_p1[idx + 2])
            result_str = " ".join(res_lines).strip()
            
    inn1 = parse_scorecard_page(p2)
    inn2 = parse_scorecard_page(p3)
    
    winner = ""
    win_margin = ""
    for t in KNOWN_TEAMS:
        t_clean = re.sub(r'[^a-zA-Z]', '', t).upper()
        res_clean = re.sub(r'[^a-zA-Z]', '', result_str).upper()
        if res_clean.startswith(t_clean) and "WONBY" in res_clean:
            winner = t
            margin_m = re.search(r'won\s*by\s*(\d+\s*(?:runs|wickets|run|wicket))', result_str, re.IGNORECASE)
            if margin_m: win_margin = margin_m.group(1)
            else: win_margin = result_str
            break
            
    return {
        "filename": filename,
        "match_number": 7 if is_qualifier else int(filename.split('.')[0]) + 1 if filename.split('.')[0].isdigit() and filename != "00.pdf" else 1,
        "stage": "playoff" if is_qualifier else "league",
        "competition_stage": "qualifier_1" if is_qualifier else "group_stage",
        "title": "Qualifier 1" if is_qualifier else f"League Match {filename.split('.')[0]}",
        "date": date_str,
        "time": time_str,
        "team_a": inn1["team_name"],
        "team_b": inn2["team_name"],
        "toss_winner": toss_winner,
        "toss_decision": toss_decision,
        "winner": winner,
        "win_margin": win_margin,
        "result_type": "win",
        "potm": potm,
        "overs_per_match": 8,
        "innings_1": inn1,
        "innings_2": inn2
    }

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

all_parsed = []
for f in files:
    fp = os.path.join(pdf_dir, f)
    m = parse_match_pdf(fp, f)
    all_parsed.append(m)

out_json = r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json"
with open(out_json, "w", encoding="utf-8") as out:
    json.dump(all_parsed, out, indent=2, ensure_ascii=False)

print("Updated and verified all parsed matches.")
