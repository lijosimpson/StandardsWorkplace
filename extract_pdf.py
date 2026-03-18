#!/usr/bin/env python
import subprocess
import sys

# Install pdfminer.six
try:
    import pdfminer
except ImportError:
    print("Installing pdfminer.six...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfminer.six"])

from pdfminer.high_level import extract_text

# Extract text from PDF
pdf_path = r"c:\Users\lijos\OneDrive\Desktop\COC\Optimal_Resources_for_Cancer_Care.pdf"

try:
    text = extract_text(pdf_path)
    
    # Print first 10000 characters
    print(text[:10000])
    
except Exception as e:
    print(f"Error extracting text: {e}")
    sys.exit(1)
