import os
import re
import json
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\all_parsed_matches.json", "r", encoding="utf-8") as f:
    matches_info = json.load(f)

for f_idx, filename in enumerate(files):
    filepath = os.path.join(pdf_dir, filename)
    reader = PdfReader(filepath)
    p4 = reader.pages[3].extract_text()
    
    print(f"\n=======================================================")
    print(f"FILE: {filename}")
    print(f"=======================================================")
    print(p4)
