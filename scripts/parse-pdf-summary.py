import os
import re
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

for filename in files:
    filepath = os.path.join(pdf_dir, filename)
    reader = PdfReader(filepath)
    p1 = reader.pages[0].extract_text()
    
    print(f"\n==================== {filename} ====================")
    lines = [l.strip() for l in p1.split('\n') if l.strip()]
    for line in lines[:25]:
        print("  ", line)
