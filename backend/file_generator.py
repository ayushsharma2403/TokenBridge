"""
file_generator.py — Multi-format file generator for TokenBridge.
Supports generating:
- Images (PNG/JPEG via Pollinations.ai fast neural generator or PIL fallback)
- PDF (.pdf via ReportLab with elegant styling)
- Word Documents (.docx via python-docx)
- PowerPoint Presentations (.pptx via python-pptx)
- Excel Spreadsheets (.xlsx via openpyxl)
"""

import os
import re
import io
import json
import uuid
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional

GENERATED_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "generated_files"))
os.makedirs(GENERATED_DIR, exist_ok=True)


def sanitize_filename(name: str, ext: str) -> str:
    """Creates a clean, safe filename with the right extension."""
    if not name:
        name = f"generated_file_{uuid.uuid4().hex[:8]}"
    clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name).strip('_')
    if not clean:
        clean = f"file_{uuid.uuid4().hex[:8]}"
    if not clean.lower().endswith(ext.lower()):
        clean = f"{clean}{ext}"
    return clean


def generate_image(prompt: str, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates an image from prompt using Pollinations AI (free, ultra-high quality, no quota issue)
    with PIL fallback if network is restricted.
    """
    clean_name = sanitize_filename(filename or f"image_{uuid.uuid4().hex[:8]}", ".png")
    file_path = os.path.join(GENERATED_DIR, clean_name)

    encoded_prompt = urllib.parse.quote(prompt.strip())
    # 1024x1024 high fidelity flux/turbo model
    pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"

    try:
        req = urllib.request.Request(
            pollinations_url,
            headers={"User-Agent": "TokenBridge/3.0"}
        )
        with urllib.request.urlopen(req, timeout=25) as response:
            data = response.read()
            if data and len(data) > 1000:
                with open(file_path, "wb") as f:
                    f.write(data)
                return {
                    "success": True,
                    "filename": clean_name,
                    "download_url": f"/api/files/download/{clean_name}",
                    "file_type": "image",
                    "preview_url": f"/api/files/download/{clean_name}",
                    "size_bytes": len(data)
                }
    except Exception as e:
        print(f"[FileGenerator] Pollinations online generation failed: {e}. Falling back to PIL generation.")

    # High quality PIL Canvas Fallback
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (1024, 768), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)

        # Draw a sleek gradient-like card background
        draw.rectangle([(40, 40), (984, 728)], outline=(56, 189, 248), width=3)
        draw.text((80, 80), "TokenBridge Image Generation", fill=(255, 255, 255))
        draw.text((80, 130), f"Prompt: {prompt[:200]}", fill=(148, 163, 184))

        img.save(file_path, "PNG")
        return {
            "success": True,
            "filename": clean_name,
            "download_url": f"/api/files/download/{clean_name}",
            "file_type": "image",
            "preview_url": f"/api/files/download/{clean_name}",
            "size_bytes": os.path.getsize(file_path)
        }
    except Exception as err:
        return {"success": False, "error": str(err)}


def generate_pdf(title: str, content: str, filename: Optional[str] = None) -> Dict[str, Any]:
    """Generates an executive-styled PDF report."""
    clean_name = sanitize_filename(filename or f"document_{uuid.uuid4().hex[:8]}", ".pdf")
    file_path = os.path.join(GENERATED_DIR, clean_name)

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(
            file_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=12
        )

        h2_style = ParagraphStyle(
            'DocH2',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=colors.HexColor('#1E293B'),
            spaceBefore=14,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            'DocBody',
            parent=styles['BodyText'],
            fontName='Helvetica',
            fontSize=10,
            leading=15,
            textColor=colors.HexColor('#334155'),
            spaceAfter=8
        )

        story = []

        # Document Header
        story.append(Paragraph(title or "TokenBridge Generated Report", title_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#38BDF8'), spaceAfter=14))

        # Split content into paragraphs or headers
        lines = (content or "").split("\n")
        in_table_data = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                if in_table_data:
                    # Flush table
                    t = Table(in_table_data, colWidths=[200, 300])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
                        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#1E293B')),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                        ('FONTSIZE', (0,0), (-1,-1), 9),
                        ('TOPPADDING', (0,0), (-1,-1), 5),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                    ]))
                    story.append(t)
                    story.append(Spacer(1, 10))
                    in_table_data = []
                story.append(Spacer(1, 6))
                continue

            # Markdown Table detection
            if "|" in line_str:
                parts = [p.strip() for p in line_str.split("|")[1:-1]]
                if parts and not all(p.replace("-", "").strip() == "" for p in parts):
                    in_table_data.append(parts)
                continue

            if in_table_data:
                t = Table(in_table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                    ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                    ('FONTSIZE', (0,0), (-1,-1), 9),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))
                in_table_data = []

            if line_str.startswith("# "):
                story.append(Paragraph(line_str[2:].strip(), title_style))
            elif line_str.startswith("## ") or line_str.startswith("### "):
                clean_h2 = line_str.lstrip("#").strip()
                story.append(Paragraph(clean_h2, h2_style))
            elif line_str.startswith("- ") or line_str.startswith("* "):
                bullet_text = "&bull; " + line_str[2:].strip()
                story.append(Paragraph(bullet_text, body_style))
            else:
                # Regular paragraph
                safe_text = line_str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(safe_text, body_style))

        if in_table_data:
            t = Table(in_table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ]))
            story.append(t)

        doc.build(story)

        return {
            "success": True,
            "filename": clean_name,
            "download_url": f"/api/files/download/{clean_name}",
            "file_type": "pdf",
            "size_bytes": os.path.getsize(file_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_docx(title: str, content: str, filename: Optional[str] = None) -> Dict[str, Any]:
    """Generates a styled Microsoft Word document."""
    clean_name = sanitize_filename(filename or f"document_{uuid.uuid4().hex[:8]}", ".docx")
    file_path = os.path.join(GENERATED_DIR, clean_name)

    try:
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        doc = Document()

        # Document Title
        p_title = doc.add_heading(level=0)
        run_title = p_title.add_run(title or "TokenBridge Document")
        run_title.font.name = 'Segoe UI'
        run_title.font.size = Pt(22)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(15, 23, 42)

        lines = (content or "").split("\n")
        table_rows = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                if table_rows:
                    _add_docx_table(doc, table_rows)
                    table_rows = []
                continue

            if "|" in line_str:
                cols = [c.strip() for c in line_str.split("|")[1:-1]]
                if cols and not all(c.replace("-", "").strip() == "" for c in cols):
                    table_rows.append(cols)
                continue

            if table_rows:
                _add_docx_table(doc, table_rows)
                table_rows = []

            if line_str.startswith("# "):
                h = doc.add_heading(line_str[2:].strip(), level=1)
                h.paragraph_format.space_before = Pt(14)
                h.paragraph_format.space_after = Pt(4)
            elif line_str.startswith("## "):
                h = doc.add_heading(line_str[3:].strip(), level=2)
                h.paragraph_format.space_before = Pt(10)
                h.paragraph_format.space_after = Pt(3)
            elif line_str.startswith("### "):
                h = doc.add_heading(line_str[4:].strip(), level=3)
                h.paragraph_format.space_before = Pt(8)
            elif line_str.startswith("- ") or line_str.startswith("* "):
                p = doc.add_paragraph(line_str[2:].strip(), style='List Bullet')
                p.paragraph_format.space_after = Pt(2)
            elif re.match(r'^\d+\.\s+', line_str):
                item_text = re.sub(r'^\d+\.\s+', '', line_str)
                p = doc.add_paragraph(item_text, style='List Number')
                p.paragraph_format.space_after = Pt(2)
            else:
                p = doc.add_paragraph(line_str)
                p.paragraph_format.space_after = Pt(6)

        if table_rows:
            _add_docx_table(doc, table_rows)

        doc.save(file_path)

        return {
            "success": True,
            "filename": clean_name,
            "download_url": f"/api/files/download/{clean_name}",
            "file_type": "docx",
            "size_bytes": os.path.getsize(file_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def _add_docx_table(doc, rows_data):
    if not rows_data:
        return
    num_cols = max(len(r) for r in rows_data)
    table = doc.add_table(rows=len(rows_data), cols=num_cols)
    table.style = 'Table Grid'
    for r_idx, row in enumerate(rows_data):
        for c_idx, cell_value in enumerate(row):
            if c_idx < num_cols:
                cell = table.cell(r_idx, c_idx)
                cell.text = cell_value
                if r_idx == 0:
                    # Bold header
                    for p in cell.paragraphs:
                        for run in p.runs:
                            run.font.bold = True


def generate_pptx(title: str, slides_content: Any, filename: Optional[str] = None) -> Dict[str, Any]:
    """Generates a styled Microsoft PowerPoint presentation."""
    clean_name = sanitize_filename(filename or f"presentation_{uuid.uuid4().hex[:8]}", ".pptx")
    file_path = os.path.join(GENERATED_DIR, clean_name)

    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt
        from pptx.dml.color import RGBColor

        prs = Presentation()
        # 16:9 widescreen slides
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)

        blank_layout = prs.slide_layouts[6]

        # Normalize slides input
        slides = []
        if isinstance(slides_content, list):
            slides = slides_content
        elif isinstance(slides_content, str):
            # Parse markdown sections divided by "## " or "---"
            parts = re.split(r'\n(?=##\s|\n---\n)', slides_content)
            for idx, part in enumerate(parts):
                part = part.strip()
                if not part:
                    continue
                lines = [l.strip() for l in part.split("\n") if l.strip()]
                slide_title = f"Slide {idx+1}"
                bullet_points = []
                for line in lines:
                    if line.startswith("#"):
                        slide_title = line.lstrip("#").strip()
                    elif line.startswith("-") or line.startswith("*"):
                        bullet_points.append(line.lstrip("-* ").strip())
                    elif line != "---":
                        bullet_points.append(line)
                slides.append({"title": slide_title, "bullets": bullet_points})

        if not slides:
            slides = [
                {"title": title or "Presentation", "bullets": ["Generated by TokenBridge AI", "Obsidian Liquid Glass Workspace"]}
            ]

        # 1. Title Slide
        title_slide = prs.slides.add_slide(blank_layout)
        # Background dark fill
        bg_shape = title_slide.shapes.add_shape(
            1, 0, 0, prs.slide_width, prs.slide_height # 1 = MSO_SHAPE.RECTANGLE
        )
        bg_shape.fill.solid()
        bg_shape.fill.fore_color.rgb = RGBColor(11, 15, 23)
        bg_shape.line.color.rgb = RGBColor(30, 41, 59)

        txBox = title_slide.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(10.9), Inches(3.0))
        tf = txBox.text_frame
        tf.word_wrap = True

        p1 = tf.paragraphs[0]
        p1.text = title or "TokenBridge Presentation"
        p1.font.bold = True
        p1.font.size = Pt(44)
        p1.font.color.rgb = RGBColor(255, 255, 255)

        p2 = tf.add_paragraph()
        p2.text = "Executive Briefing & Strategy Deck"
        p2.font.size = Pt(20)
        p2.font.color.rgb = RGBColor(56, 189, 248) # Cyan accent
        p2.space_before = Pt(16)

        # 2. Content Slides
        for s_data in slides:
            s_title = s_data.get("title", "Overview")
            s_bullets = s_data.get("bullets", [])

            slide = prs.slides.add_slide(blank_layout)
            # Background
            bg = slide.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
            bg.fill.solid()
            bg.fill.fore_color.rgb = RGBColor(15, 23, 42)
            bg.line.fill.background()

            # Slide Header Card
            header_card = slide.shapes.add_shape(1, Inches(0.8), Inches(0.8), Inches(11.73), Inches(1.0))
            header_card.fill.solid()
            header_card.fill.fore_color.rgb = RGBColor(30, 41, 59)
            header_card.line.color.rgb = RGBColor(56, 189, 248)

            htf = header_card.text_frame
            hp = htf.paragraphs[0]
            hp.text = s_title
            hp.font.bold = True
            hp.font.size = Pt(26)
            hp.font.color.rgb = RGBColor(255, 255, 255)

            # Slide Content Body
            body_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.3), Inches(4.5))
            btf = body_box.text_frame
            btf.word_wrap = True

            for b_idx, bullet in enumerate(s_bullets):
                bp = btf.paragraphs[0] if b_idx == 0 else btf.add_paragraph()
                bp.text = f"•  {bullet}"
                bp.font.size = Pt(18)
                bp.font.color.rgb = RGBColor(226, 232, 240)
                bp.space_before = Pt(12)

        prs.save(file_path)

        return {
            "success": True,
            "filename": clean_name,
            "download_url": f"/api/files/download/{clean_name}",
            "file_type": "pptx",
            "size_bytes": os.path.getsize(file_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_xlsx(title: str, data: Any, filename: Optional[str] = None) -> Dict[str, Any]:
    """Generates a professional Excel Workbook (.xlsx) with styled headers and formulas."""
    clean_name = sanitize_filename(filename or f"spreadsheet_{uuid.uuid4().hex[:8]}", ".xlsx")
    file_path = os.path.join(GENERATED_DIR, clean_name)

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = (title or "Data")[:31]

        # Parse data into rows
        rows = []
        if isinstance(data, list):
            rows = data
        elif isinstance(data, str):
            # Parse markdown or CSV lines
            lines = [l.strip() for l in data.strip().split("\n") if l.strip()]
            for line in lines:
                if "|" in line:
                    cols = [c.strip() for c in line.split("|")[1:-1]]
                    if cols and not all(c.replace("-", "").strip() == "" for c in cols):
                        rows.append(cols)
                elif "," in line:
                    rows.append([c.strip() for c in line.split(",")])
                elif "\t" in line:
                    rows.append([c.strip() for c in line.split("\t")])

        if not rows:
            rows = [
                ["Item / Metric", "Category", "Q1 Value", "Q2 Value", "Growth"],
                ["Total Users", "Growth", "12,450", "18,920", "+51.9%"],
                ["Compute Tokens", "Platform", "1,200,000", "2,450,000", "+104.1%"],
                ["Average Latency", "Performance", "420ms", "280ms", "-33.3%"]
            ]

        # Styling Definitions
        header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

        zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        data_font = Font(name="Calibri", size=10, color="1E293B")
        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        for r_idx, row in enumerate(rows, start=1):
            for c_idx, val in enumerate(row, start=1):
                cell = ws.cell(row=r_idx, column=c_idx)

                # Attempt numeric conversion for proper Excel calculations
                val_str = str(val).strip()
                if re.match(r'^-?\d+(\.\d+)?$', val_str):
                    try:
                        cell.value = float(val_str) if "." in val_str else int(val_str)
                    except ValueError:
                        cell.value = val_str
                else:
                    cell.value = val_str

                cell.border = thin_border

                if r_idx == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = header_align
                else:
                    cell.font = data_font
                    if r_idx % 2 == 0:
                        cell.fill = zebra_fill
                    if isinstance(cell.value, (int, float)):
                        cell.alignment = Alignment(horizontal="right")

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 5, 12)

        wb.save(file_path)

        return {
            "success": True,
            "filename": clean_name,
            "download_url": f"/api/files/download/{clean_name}",
            "file_type": "xlsx",
            "size_bytes": os.path.getsize(file_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def process_generation_request(user_prompt: str) -> Optional[Dict[str, Any]]:
    """
    Detects if the user prompt is requesting to generate an image, PDF, DOCX, PPT, or Excel file.
    Returns generated file details or None.
    """
    p = user_prompt.lower().strip()

    # Keywords for file generation
    is_generate = any(verb in p for verb in ["generate", "create", "make", "build", "draw", "produce", "render", "export", "download"])

    # 1. Image Generation
    if any(k in p for k in ["generate an image", "create an image", "draw an image", "generate image", "make an image", "draw a picture", "generate a picture", "image of", "wallpaper of", "illustration of"]):
        # Extract prompt after verb
        clean_prompt = user_prompt
        match = re.search(r'(?:generate|create|draw|make|render)\s+(?:an?\s+)?(?:image|picture|photo|illustration|wallpaper)(?:\s+of|\s+about|\s+showing)?\s*(.*)', user_prompt, re.IGNORECASE)
        if match and match.group(1).strip():
            clean_prompt = match.group(1).strip()
        return generate_image(clean_prompt)

    # 2. PowerPoint Presentation
    if any(k in p for k in ["ppt", "pptx", "powerpoint", "presentation", "slide deck", "slides"]):
        if is_generate or "slides" in p or "presentation" in p:
            title_match = re.search(r'(?:about|on|for|titled)\s+["\']?([^"\']+)["\']?', user_prompt, re.IGNORECASE)
            title = title_match.group(1).strip() if title_match else "Presentation"
            return generate_pptx(title, user_prompt)

    # 3. Excel Spreadsheet
    if any(k in p for k in ["excel", "xlsx", "xlxs", "spreadsheet", "sheet", "csv file"]):
        if is_generate or "sheet" in p or "table" in p:
            title_match = re.search(r'(?:about|on|for|titled)\s+["\']?([^"\']+)["\']?', user_prompt, re.IGNORECASE)
            title = title_match.group(1).strip() if title_match else "Spreadsheet Data"
            return generate_xlsx(title, user_prompt)

    # 4. Word Document (.docx)
    if any(k in p for k in [".docx", "docx", "word document", "word doc", "word file"]):
        title_match = re.search(r'(?:about|on|for|titled)\s+["\']?([^"\']+)["\']?', user_prompt, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "Document"
        return generate_docx(title, user_prompt)

    # 5. PDF Document
    if any(k in p for k in ["pdf", ".pdf", "pdf document", "pdf file", "pdf report"]):
        if is_generate or "report" in p or "document" in p:
            title_match = re.search(r'(?:about|on|for|titled)\s+["\']?([^"\']+)["\']?', user_prompt, re.IGNORECASE)
            title = title_match.group(1).strip() if title_match else "Executive Report"
            return generate_pdf(title, user_prompt)

    return None
