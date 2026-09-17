"""
file_converter.py

Converts uploaded files to Markdown to save tokens.
Supported: PDF, DOCX, TXT, CSV, PNG/JPG (via Gemini Vision)
"""

import os
import pymupdf
from docx import Document


def pdf_to_markdown(file_bytes: bytes) -> str:
    doc  = pymupdf.open(stream=file_bytes, filetype="pdf")
    text = ""
    for i, page in enumerate(doc):
        page_num = i + 1
        text += "## Page " + str(page_num) + "\n\n"
        text += page.get_text()
        text += "\n\n"
    doc.close()
    return text.strip()


def docx_to_markdown(file_bytes: bytes) -> str:
    import io
    doc  = Document(io.BytesIO(file_bytes))
    text = ""
    for para in doc.paragraphs:
        if para.style.name.startswith("Heading"):
            try:
                level = int(para.style.name.split()[-1])
            except ValueError:
                level = 1
            text += "#" * level + " " + para.text + "\n\n"
        elif para.text.strip():
            text += para.text + "\n\n"
    return text.strip()


def txt_to_markdown(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")


def csv_to_markdown(file_bytes: bytes) -> str:
    import io
    import csv
    content = file_bytes.decode("utf-8", errors="ignore")
    reader  = csv.reader(io.StringIO(content))
    rows    = list(reader)
    if not rows:
        return ""
    headers = rows[0]
    md      = "| " + " | ".join(headers) + " |\n"
    md     += "| " + " | ".join(["---"] * len(headers)) + " |\n"
    for row in rows[1:]:
        md += "| " + " | ".join(row) + " |\n"
    return md


def image_to_markdown(file_bytes: bytes, filename: str, api_key: str) -> str:
    import google.generativeai as genai
    from PIL import Image
    import io

    genai.configure(api_key=api_key)
    model    = genai.GenerativeModel("gemini-3.6-flash")
    image    = Image.open(io.BytesIO(file_bytes))
    response = model.generate_content(
        ["Extract all text and information from this image. Format it as clean markdown.", image]
    )
    return response.text.strip()


def convert_file(file_bytes: bytes, filename: str, api_key: str = None) -> dict:
    """
    Detects file type and converts to markdown.
    Returns: {markdown, filename, original_size, markdown_size, reduction}
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        markdown = pdf_to_markdown(file_bytes)
    elif ext == ".docx":
        markdown = docx_to_markdown(file_bytes)
    elif ext in [".txt", ".md"]:
        markdown = txt_to_markdown(file_bytes)
    elif ext == ".csv":
        markdown = csv_to_markdown(file_bytes)
    elif ext in [".png", ".jpg", ".jpeg", ".webp"] and api_key:
        markdown = image_to_markdown(file_bytes, filename, api_key)
    elif ext in [".png", ".jpg", ".jpeg", ".webp"] and not api_key:
        return {"error": "API key required for image conversion. Paste your Gemini key in the sidebar."}
    else:
        return {"error": "Unsupported file type: " + ext + ". Supported: PDF, DOCX, TXT, CSV, PNG, JPG"}

    original_size = len(file_bytes)
    markdown_size = len(markdown.encode("utf-8"))
    reduction     = round((1 - markdown_size / original_size) * 100) if original_size > 0 else 0

    return {
        "markdown":      markdown,
        "filename":      filename,
        "original_size": original_size,
        "markdown_size": markdown_size,
        "reduction":     str(reduction) + "% smaller"
    }
