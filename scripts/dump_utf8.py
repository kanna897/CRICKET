import os
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

with open(r"c:\Users\Mr.Cherry\Desktop\CRICKET LIVE SCORING\crickpulse\scripts\full_pdf_dump_utf8.txt", "w", encoding="utf-8") as out:
    for f in files:
        fp = os.path.join(pdf_dir, f)
        reader = PdfReader(fp)
        out.write(f"\n{'='*70}\n")
        out.write(f"FILE: {f} (Total Pages: {len(reader.pages)})\n")
        out.write(f"{'='*70}\n")
        for idx, page in enumerate(reader.pages):
            out.write(f"\n--- PAGE {idx+1} OF {f} ---\n")
            out.write(page.extract_text() + "\n")

print("Dumped in UTF-8 successfully.")
