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
    "KajavathananNT": "Kajavathanan NT"
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
    # block lines format:
    # 0: Tokens (could span 1 or 2 lines)
    # Batter 1: Name Runs(Balls)
    # Batter 2: Name Runs(Balls)
    # Bowler: Name
    # Bowler stats: 1.0-0-5-1
    # Summary: Overs X Runs Y Score Z-W
    
    summary_line = block_lines[-1]
    bowler_stats_line = block_lines[-2]
    bowler_name_line = block_lines[-3]
    
    # Extract bowler name & figures
    bowler_name = clean_name(bowler_name_line)
    
    # Extract batters
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
        "bowler_stats": bowler_stats_line,
        "summary": summary_line
    }

print("Loaded block parser helper.")
