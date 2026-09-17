"""
file_converter.py

Converts uploaded files to Markdown (.md) to save tokens and provide clean context.
Supported: PDF, DOCX, TXT, MD, CSV, TSV, JSON, Code files (Python, JS, HTML, etc.), Images (Vision AI)
"""

import os
import io
import csv
import pymupdf
from docx import Document


CODE_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".java": "java",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".r": "r",
    ".dart": "dart",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".toml": "toml",
    ".ini": "ini",
    ".env": "bash",
    ".log": "text",
}


def pdf_to_markdown(file_bytes: bytes) -> str:
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        text = ""
        for i, page in enumerate(doc):
            page_num = i + 1
            page_text = page.get_text()
            if page_text.strip():
                text += f"## Page {page_num}\n\n"
                text += page_text.strip()
                text += "\n\n"
        doc.close()
        if not text.strip():
            return "_No extractable text found in this PDF. It may contain scanned images._"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Could not read PDF: {str(e)}")


def docx_to_markdown(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = ""
        for para in doc.paragraphs:
            clean_text = para.text.strip()
            if not clean_text:
                continue
            if para.style.name.startswith("Heading"):
                try:
                    level = int(para.style.name.split()[-1])
                except ValueError:
                    level = 1
                text += "#" * level + " " + clean_text + "\n\n"
            else:
                text += clean_text + "\n\n"

        # Also extract text from tables if present
        for table in doc.tables:
            for row in table.rows:
                row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                if any(row_cells):
                    text += "| " + " | ".join(row_cells) + " |\n"
            text += "\n"

        if not text.strip():
            return "_No extractable text found in this DOCX file._"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Could not read DOCX document: {str(e)}")


def txt_to_markdown(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return file_bytes.decode("latin-1")
        except Exception:
            return file_bytes.decode("utf-8", errors="ignore")


def csv_to_markdown(file_bytes: bytes, is_tsv: bool = False) -> str:
    try:
        content = txt_to_markdown(file_bytes)
        delimiter = "\t" if is_tsv else ("," if "," in content.splitlines()[0] else "\t")
        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        rows = [row for row in reader if any(cell.strip() for cell in row)]
        if not rows:
            return "_Empty spreadsheet or table._"

        headers = [h.strip() for h in rows[0]]
        num_cols = len(headers)
        md = "| " + " | ".join(headers) + " |\n"
        md += "| " + " | ".join(["---"] * num_cols) + " |\n"

        for row in rows[1:]:
            padded_row = [cell.strip() for cell in row]
            if len(padded_row) < num_cols:
                padded_row += [""] * (num_cols - len(padded_row))
            elif len(padded_row) > num_cols:
                padded_row = padded_row[:num_cols]
            md += "| " + " | ".join(padded_row) + " |\n"

        return md.strip()
    except Exception as e:
        raise ValueError(f"Could not parse CSV/TSV table: {str(e)}")


def code_to_markdown(file_bytes: bytes, filename: str, ext: str) -> str:
    content = txt_to_markdown(file_bytes)
    lang = CODE_EXTENSIONS.get(ext, "")
    basename = os.path.basename(filename)
    return f"### `{basename}`\n\n```{lang}\n{content}\n```"


def image_to_markdown(file_bytes: bytes, filename: str, api_key: str) -> str:
    from PIL import Image
    import base64

    # Determine provider by API key format
    if api_key.startswith("sk-ant-"):
        # Claude Vision
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        ext = os.path.splitext(filename)[1].lower().replace(".", "")
        media_type = f"image/{ext}" if ext in ["png", "jpeg", "webp", "gif"] else "image/jpeg"
        res = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": "Extract all text, tables, and details from this image. Format as clean Markdown."}
                ]
            }]
        )
        return res.content[0].text.strip()
    elif api_key.startswith("sk-") and not api_key.startswith("sk-ant-"):
        # OpenAI Vision
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        ext = os.path.splitext(filename)[1].lower().replace(".", "")
        media_type = f"image/{ext}" if ext in ["png", "jpeg", "webp", "gif"] else "image/jpeg"
        res = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all text, tables, and details from this image. Format as clean Markdown."},
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}}
                ]
            }]
        )
        return res.choices[0].message.content.strip()
    else:
        # Gemini Vision (default)
        import google.generativeai as genai
        from config import GEMINI_MODEL

        genai.configure(api_key=api_key)
        models_to_try = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-flash-latest"]
        candidates = []
        for m in models_to_try:
            clean = (m or "").replace("models/", "").strip()
            if clean and clean not in ["gemini-1.5-flash", "gemini-2.5-flash"] and clean not in candidates:
                candidates.append(clean)
        if not candidates:
            candidates = ["gemini-3.6-flash", "gemini-flash-latest"]

        image = Image.open(io.BytesIO(file_bytes))
        last_error = None
        for model_name in candidates:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    ["Extract all text, tables, and information from this image. Format it as clean Markdown.", image]
                )
                return response.text.strip()
            except Exception as e:
                last_error = e
                err_msg = str(e)
                if "404" in err_msg or "not found" in err_msg.lower() or "not supported" in err_msg.lower():
                    continue
                raise e
        raise last_error


def convert_file(file_bytes: bytes, filename: str, api_key: str = None) -> dict:
    """
    Detects file type and converts to markdown.
    Returns: {markdown, filename, md_filename, original_size, markdown_size, reduction}
    """
    ext = os.path.splitext(filename)[1].lower()
    base = os.path.splitext(filename)[0]
    md_filename = f"{base}.md"

    try:
        if ext == ".pdf":
            markdown = pdf_to_markdown(file_bytes)
        elif ext in [".docx", ".doc"]:
            markdown = docx_to_markdown(file_bytes)
        elif ext in [".md", ".markdown"]:
            markdown = txt_to_markdown(file_bytes)
        elif ext == ".txt":
            markdown = txt_to_markdown(file_bytes)
        elif ext in [".csv", ".tsv"]:
            markdown = csv_to_markdown(file_bytes, is_tsv=(ext == ".tsv"))
        elif ext in CODE_EXTENSIONS:
            markdown = code_to_markdown(file_bytes, filename, ext)
        elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
            if not api_key:
                return {"error": "API key required for image conversion. Paste your Gemini, OpenAI, or Claude key in the sidebar."}
            markdown = image_to_markdown(file_bytes, filename, api_key)
        else:
            supported = "PDF, DOCX, TXT, MD, CSV, TSV, Code (.py, .js, .ts, .json, .html, .css, .sql, etc.), PNG, JPG"
            return {"error": f"Unsupported file type: '{ext}'. Supported: {supported}"}
    except Exception as e:
        return {"error": f"Failed to convert {filename}: {str(e)}"}

    original_size = len(file_bytes)
    markdown_size = len(markdown.encode("utf-8"))
    
    if original_size > 0:
        ratio = round((1 - markdown_size / original_size) * 100)
        if ratio > 0:
            reduction = f"{ratio}% smaller"
        elif ratio == 0:
            reduction = "0% difference"
        else:
            reduction = "Formatted as .md"
    else:
        reduction = "0% difference"

    return {
        "markdown":      markdown,
        "filename":      filename,
        "md_filename":   md_filename,
        "original_size": original_size,
        "markdown_size": markdown_size,
        "reduction":     reduction
    }
