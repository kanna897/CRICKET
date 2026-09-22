import os
import re
import json
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

parsed_matches = []

for filename in files:
    filepath = os.path.join(pdf_dir, filename)
    reader = PdfReader(filepath)
    full_text = "\n--- PAGE ---\n".join([page.extract_text() for page in reader.pages])
    
    match_data = {
        "filename": filename,
        "raw_pages": [p.extract_text() for p in reader.pages]
    }
    parsed_matches.append(match_data)

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\extracted_matches_raw.json", "w", encoding="utf-8") as f:
    json.dump(parsed_matches, f, indent=2, ensure_ascii=False)

print("Extracted raw text from all 7 PDFs.")
