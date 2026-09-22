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

def parse_page4_blocks_smart(filepath, inn1_team, inn2_team, inn1_bowlers, inn2_bowlers):
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
    
    # Standardize bowler sets
    inn1_bowler_names = set([b["name"].lower() for b in inn1_bowlers])
    inn2_bowler_names = set([b["name"].lower() for b in inn2_bowlers])
    
    for b in blocks:
        bowler = clean_name(b[-3]).lower()
        if bowler in inn1_bowler_names:
            inn1_blocks.append(b)
        elif bowler in inn2_bowler_names:
            inn2_blocks.append(b)
        else:
            # Fallback by over sequence
            print(f"Warning: Bowler {bowler} not found in inn1 or inn2 bowler lists!")
            
    return inn1_blocks, inn2_blocks

for f_idx, filename in enumerate(files):
    filepath = os.path.join(pdf_dir, filename)
    m = matches_info[f_idx]
    inn1_b, inn2_b = parse_page4_blocks_smart(
        filepath,
        m["innings_1"]["team_name"],
        m["innings_2"]["team_name"],
        m["innings_1"]["bowling"],
        m["innings_2"]["bowling"]
    )
    print(f"{filename}: Inn1 blocks = {len(inn1_b)}, Inn2 blocks = {len(inn2_b)}")
