import os
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

for f in files:
    fp = os.path.join(pdf_dir, f)
    reader = PdfReader(fp)
    print(f"\n#################################################################")
    print(f"FILE: {f} (Total Pages: {len(reader.pages)})")
    print(f"#################################################################")
    for idx, page in enumerate(reader.pages):
        print(f"\n--- PAGE {idx+1} OF {f} ---")
        print(page.extract_text())
