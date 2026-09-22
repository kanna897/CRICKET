import os
from pypdf import PdfReader

pdf_dir = r"C:\Users\Mr.Cherry\Downloads\attachments"
files = ["00.pdf", "1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"]

for filename in files:
    filepath = os.path.join(pdf_dir, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filename}")
        continue
    reader = PdfReader(filepath)
    print(f"\n==========================================")
    print(f"FILE: {filename} (Pages: {len(reader.pages)})")
    print(f"==========================================")
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        print(f"--- PAGE {i+1} ---")
        print(text[:1500]) # First 1500 chars of each page
        if len(text) > 1500:
            print("... [truncated page content] ...")
