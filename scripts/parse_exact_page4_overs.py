import os
import re
import json
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches_info = json.load(f)

def clean_name(n):
    n = re.sub(r'([a-z])([A-Z])', r'\1 \2', n)
    n = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', n)
    n = n.strip()
    fixes = {
        "Gopi Krishna": "Gopikrishna",
        "Kajavathanan Nt": "Kajavathanan NT",
        "MayooranS": "Mayooran S",
        "AlthafHussain": "Althaf Hussain",
        "ZaxsanCroos": "Zaxsan Croos",
    }
    return fixes.get(n, n)

def parse_page4_overs(filepath):
    reader = PdfReader(filepath)
    p4 = reader.pages[3].extract_text()
    lines = [l.strip() for l in p4.split('\n') if l.strip()]
    
    # Remove header/footer
    filtered = []
    for l in lines:
        if "Download'STUMPS" in l or "Matchreportcreatedfrom" in l or l == "STUMPS" or l == "OverComparison" or l == "Over Comparison":
            continue
        filtered.append(l)
        
    # The first line is Team1 Team2 header, e.g. "RISINGTITANS ROYALSTRIKERS" or "PRIME XI RISING TITANS"
    # Then blocks ending with "Overs X Runs Y Score Z-W"
    blocks = []
    curr = []
    
    # Skip team names line
    idx = 0
    if idx < len(filtered) and not re.search(r'Overs\s+\d', filtered[idx]):
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
        
    print(f"Found {len(blocks)} over blocks.")
    
    # Separate into Innings 1 and Innings 2
    # In STUMPS, blocks alternate: Inn1 Over 1, Inn2 Over 1, Inn1 Over 2, Inn2 Over 2, ...
    inn1_blocks = []
    inn2_blocks = []
    
    for b_idx, block in enumerate(blocks):
        if b_idx % 2 == 0:
            inn1_blocks.append(block)
        else:
            inn2_blocks.append(block)
            
    return inn1_blocks, inn2_blocks

for f_idx, filename in enumerate(files):
    filepath = os.path.join(pdf_dir, filename)
    print(f"\n=================================================")
    print(f"FILE: {filename}")
    print(f"=================================================")
    inn1_b, inn2_b = parse_page4_overs(filepath)
    print(f"Inn1 blocks: {len(inn1_b)}, Inn2 blocks: {len(inn2_b)}")
    for i, b in enumerate(inn1_b):
        print(f"  Inn1 Over {i+1}: {' | '.join(b)}")
    for i, b in enumerate(inn2_b):
        print(f"  Inn2 Over {i+1}: {' | '.join(b)}")
