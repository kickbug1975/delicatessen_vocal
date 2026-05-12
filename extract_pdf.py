import pdfplumber
import sys

def main():
    pdf_path = "asset/Liste des prix.pdf"
    print(f"Reading {pdf_path}...")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                print(f"--- PAGE {i+1} ---")
                print(page.extract_text())
                
                # Also try to print tables if any
                tables = page.extract_tables()
                if tables:
                    print(f"--- TABLES IN PAGE {i+1} ---")
                    for j, table in enumerate(tables):
                        for row in table:
                            print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
