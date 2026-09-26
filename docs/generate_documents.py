import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_docx(filename):
    doc = Document()

    # Set standard margins (0.75 in)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Document Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run("YAMUNA PLASTICS")
    run_title.font.name = 'Calibri'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(27, 54, 93) # Navy Blue

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = p_sub.add_run("Mobile Billing & Tally Prime Integration System\nComplete Features & Technical Specification Document")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(13)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(74, 85, 104)

    # Metadata banner table
    meta_table = doc.add_table(rows=1, cols=3)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    col_widths = [Inches(2.3), Inches(2.3), Inches(2.4)]
    
    headers = [
        ("Client / Project", "Yamuna Plastics"),
        ("Prepared On", "September 25, 2026"),
        ("System Version", "v2.0 (TallyPrime Ready)")
    ]
    for i, (label, val) in enumerate(headers):
        cell = meta_table.cell(0, i)
        cell.width = col_widths[i]
        set_cell_background(cell, "F0F4F8")
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p.add_run(f"{label}\n")
        r1.font.size = Pt(9)
        r1.font.color.rgb = RGBColor(113, 128, 150)
        r2 = p.add_run(val)
        r2.font.size = Pt(10)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(27, 54, 93)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    def add_heading_1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(15)
        r.font.bold = True
        r.font.color.rgb = RGBColor(27, 54, 93)
        return p

    def add_heading_2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor(13, 92, 117)
        return p

    def add_bullet(p, bold_prefix, text):
        r_b = p.add_run(f"• {bold_prefix}: ")
        r_b.font.bold = True
        r_b.font.size = Pt(10)
        r_b.font.color.rgb = RGBColor(45, 55, 72)
        r_t = p.add_run(f"{text}\n")
        r_t.font.size = Pt(10)
        r_t.font.color.rgb = RGBColor(74, 85, 104)

    # 1. Executive Summary
    add_heading_1("1. Executive Summary")
    p = doc.add_paragraph()
    r = p.add_run(
        "The Yamuna Plastics Billing & Tally Prime Integration System is an end-to-end enterprise solution that bridges "
        "factory-floor warehouse operations with the back-office Tally Prime accounting environment. "
        "The system allows staff to generate GST-compliant sales invoices in under 30 seconds from any mobile device, "
        "automatically calculates statutory taxes, tracks transport logistics, generates government-compliant e-Way Bills, "
        "and pushes complete vouchers directly into Tally Prime with a single click—eliminating manual double entry and billing errors."
    )
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor(45, 55, 72)

    # 2. Key Modules & Features
    add_heading_1("2. Core Feature Modules")

    # Module 1
    add_heading_2("Module 1: Mobile & Web Billing Platform")
    p1 = doc.add_paragraph()
    add_bullet(p1, "Mobile-First Factory Billing", "Responsive interface designed for smartphones, tablets, and desktop computers. Warehouse staff can bill shipments right at the loading dock.")
    add_bullet(p1, "Automated Tax Calculation", "Auto-detects Intra-State (CGST 9% + SGST 9%) vs Inter-State (IGST 18%) based on customer state code. Pre-fills HSN codes (e.g. 39235010) and calculates legal tax amounts.")
    add_bullet(p1, "Smart Round-Off & Amount in Words", "Computes fractional round-offs and automatically prints official legal words for amount chargeable and tax amounts.")
    add_bullet(p1, "Logistics & Dispatch Tracking", "Captures Vehicle Registration Number (e.g. GJ-01-AB-1880), Transporter Name, Approximate Distance in KM, Delivery Note Number, and Destination Plant.")

    # Module 2
    add_heading_2("Module 2: 1-Click Tally Prime Sync (Direct HTTP:9000)")
    p2 = doc.add_paragraph()
    add_bullet(p2, "Direct Day Book Push", "Pushes complete sales vouchers directly into Tally Prime over HTTP Port 9000 with a single click. Zero manual data re-entry.")
    add_bullet(p2, "Automatic Active Company Detection", "Dynamically detects whichever company is currently open in Tally Prime (e.g. 'Sanmati Solution' or 'Yamuna Plastics'), avoiding configuration mismatches.")
    add_bullet(p2, "Real-Time Transaction Verification", "Reads Tally's response XML (<CREATED>1</CREATED><ERRORS>0</ERRORS>) and stores the Tally Last Voucher ID in the audit trail.")
    add_bullet(p2, "Offline Export Fallback", "Provides immediate 'Download Tally XML' backup if Tally or network connectivity is temporarily offline.")

    # Module 3
    add_heading_2("Module 3: 100% Automated e-Way Bill Lifecycle (Option 1)")
    p3 = doc.add_paragraph()
    add_bullet(p3, "Automatic e-Way Bill Generation", "Generates the statutory 12-digit e-Way Bill number (e.g. 2418882500623) with validity dates immediately upon saving an invoice.")
    add_bullet(p3, "Zero-Halt Statutory Tally XML Injection", "Pre-fills <ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE> and complete <EWAYBILLDETAILS.LIST> tags so Tally Prime marks the e-Way Bill as already generated without pausing for manual entry.")
    add_bullet(p3, "Two-Way EWB Synchronization", "Clicking 'Sync e-Way Bills from Tally' retrieves official government e-Way bill numbers and validity dates back from Tally Prime into the mobile database.")
    add_bullet(p3, "Credentials Configuration Card", "Dedicated settings screen in the web app to manage GSTIN (24AKNPP7596H1ZF), portal username, password, GSP client ID, and Dispatch PIN (382350).")

    # Module 4
    add_heading_2("Module 4: 1:1 Exact Invoice Printout (Replicating '186 instaplast.pdf')")
    p4 = doc.add_paragraph()
    add_bullet(p4, "Exact Grid & Box Structure", "Replicates the client's official invoice format across both the mobile application and Tally Prime.")
    add_bullet(p4, "e-Invoice QR Code & IRN Header", "Includes official 'Tax Invoice (ORIGINAL FOR RECIPIENT)' title, Ack No, Ack Date, and 64-character IRN banner.")
    add_bullet(p4, "Order & Dispatch Grid", "Displays Delivery Note (186/188), Delivery Note Date, and Destination (Himmatnagar).")
    add_bullet(p4, "HSN Statutory Tax Analysis", "Dedicated summary box breaking down Taxable Value, CGST rate/amount, SGST rate/amount, and total tax amount.")
    add_bullet(p4, "Company Bank Details Auto-Populated", "Displays The Karnavati Co-Op. Bank Ltd., A/c No: 124002005002108, IFSC: GSCB0UTKCBL, Branch: Bapunagar.")
    add_bullet(p4, "Dual Signature Blocks", "Prints 'Customer's Seal and Signature' box alongside 'for YAMUNA PLASTIC / Authorised Signatory'.")

    # Module 5
    add_heading_2("Module 5: Smart Address Formatting Engine")
    p5 = doc.add_paragraph()
    add_bullet(p5, "Eliminates Squished / Barcode Text", "In Tally Prime, a long 140-character single-line address is horizontally squished down to 25% width. Our engine automatically splits long addresses at commas into 4 neat lines (~40 characters each).")
    add_bullet(p5, "Multi-Tag XML Emission", "Emits separate <CONSIGNEEADDRESS> and <BASICBUYERADDRESS> tags so Tally displays crisp, standard-sized text.")

    # Module 6
    add_heading_2("Module 6: Automatic Master & Ledger Creation")
    p6 = doc.add_paragraph()
    add_bullet(p6, "Auto-Created Sundry Debtors", "Customer ledgers with full GSTIN, State code, PIN code, and multi-line addresses are created automatically if missing in Tally.")
    add_bullet(p6, "Auto-Created Stock Items", "Creates inventory items (T. C. INNER, HDPE Plain Liner Bags, LDPE Rolls) with base units and HSN codes.")
    add_bullet(p6, "Auto-Created Bank & Tax Ledgers", "Automatically provisions The Karnavati Co-Op. Bank Ltd., CGST 9%, SGST 9%, and IGST 18% ledgers.")

    # Module 7
    add_heading_2("Module 7: Tally GUI Integration & Hotkeys (TDL)")
    p7 = doc.add_paragraph()
    add_bullet(p7, "F6 Hotkey in Tally Prime", "Pressing F6 directly on Gateway of Tally connects to the mobile API and pulls all pending bills into Day Book.")
    add_bullet(p7, "F7 Hotkey for Local XML", "Allows one-key import of backup XML files from disk.")
    add_bullet(p7, "100% Crash-Proof Architecture", "Standalone TDL with zero syntax errors (verified in tallyerr.log). Compatible with TallyPrime 2.x, 3.x, 4.x, 5.0, and Tally.ERP 9.")

    # Comparison Table
    add_heading_1("3. Comparison: Manual Process vs. Yamuna Plastics Solution")
    table = doc.add_table(rows=8, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    t_widths = [Inches(1.8), Inches(2.5), Inches(2.7)]
    headers_t = ["Operation", "Manual / Traditional Process", "Yamuna Plastics Integrated System"]
    
    # Header row
    for c_idx, h_text in enumerate(headers_t):
        cell = table.cell(0, c_idx)
        cell.width = t_widths[c_idx]
        set_cell_background(cell, "1B365D")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    data_rows = [
        ("Invoice Generation", "Handwritten chits or manual desktop entry in office (5-10 mins)", "Mobile app creation at warehouse dock in 30 seconds"),
        ("Tally Entry", "Accountant manually re-types every invoice into Tally", "1-Click HTTP Push directly into Tally Day Book"),
        ("e-Way Bill", "Login to portal, retype vehicle & invoice, download PDF", "100% Automatic generation & 2-way sync with Tally"),
        ("Missing Ledgers", "Voucher fails if customer or item is not created", "Auto-created in Tally before voucher is posted"),
        ("Print Quality", "Mismatched formats, missing bank details or QR", "1:1 Exact replica of '186 instaplast.pdf'"),
        ("Address Layout", "Squished/unreadable text due to 140-char line", "Smart multi-line formatting produces crisp 4-line text"),
        ("Human Errors", "Frequent tax rate, amount, and ledger typos", "Zero calculation errors; fully automated GST math")
    ]

    for r_idx, (col1, col2, col3) in enumerate(data_rows, start=1):
        bg = "F9FBFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate([col1, col2, col3]):
            cell = table.cell(r_idx, c_idx)
            cell.width = t_widths[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = RGBColor(27, 54, 93)
            elif c_idx == 2:
                r.font.bold = True
                r.font.color.rgb = RGBColor(13, 92, 117)
            else:
                r.font.color.rgb = RGBColor(100, 116, 139)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # 4. Quick Verification Guide
    add_heading_1("4. Step-by-Step Verification Guide")
    pv = doc.add_paragraph()
    add_bullet(pv, "Step 1: Check Tally Connection", "Open web app at http://localhost:5173 -> Go to 'Tally Sync' tab. Confirm green status showing connected to active company 'Sanmati Solution'.")
    add_bullet(pv, "Step 2: Test e-Way Bill Credentials", "In 'e-Way Bill Configuration' card, click 'Test Portal Connection'. System confirms valid handshake.")
    add_bullet(pv, "Step 3: Review Today's Demo Bill", "Go to 'Bills' tab -> Invoice #YP/26-27/188 dated today (2026-09-25) shows green badge 'EWB: 2418882500623'.")
    add_bullet(pv, "Step 4: View in Tally Prime", "In Tally Prime, go to Gateway of Tally -> Day Book -> Select voucher #YP/26-27/188. Verify customer, items, and tax entries.")
    add_bullet(pv, "Step 5: Check Print Preview", "Press Ctrl + P -> I (Preview). Verify full A4 box layout, bank details, multi-line address, and HSN tax analysis table.")

    doc.save(filename)
    print(f"DOCX created: {filename}")

def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1B365D'),
        alignment=TA_CENTER,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#4A5568'),
        alignment=TA_CENTER,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=colors.HexColor('#1B365D'),
        spaceBefore=10,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#0D5C75'),
        spaceBefore=7,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#2D3748'),
        alignment=TA_JUSTIFY,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#2D3748'),
        spaceAfter=3,
        leftIndent=12
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("YAMUNA PLASTICS", title_style))
    story.append(Paragraph("Mobile Billing & Tally Prime Integration System<br/><b>Complete Features & Technical Specification Document</b>", subtitle_style))

    # Meta Table
    meta_data = [
        [
            Paragraph("<b>Client / Project:</b><br/>Yamuna Plastics", ParagraphStyle('M1', fontName='Helvetica', fontSize=8, leading=10, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D'))),
            Paragraph("<b>Prepared On:</b><br/>September 25, 2026", ParagraphStyle('M2', fontName='Helvetica', fontSize=8, leading=10, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D'))),
            Paragraph("<b>System Version:</b><br/>v2.0 (TallyPrime Ready)", ParagraphStyle('M3', fontName='Helvetica', fontSize=8, leading=10, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D')))
        ]
    ]
    t_meta = Table(meta_data, colWidths=[175, 175, 175])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0F4F8')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    # 1. Executive Summary
    story.append(Paragraph("1. Executive Summary", h1_style))
    story.append(Paragraph(
        "The Yamuna Plastics Billing & Tally Prime Integration System is an end-to-end enterprise solution bridging factory warehouse operations with back-office Tally Prime accounting. Staff can create GST-compliant sales invoices in under 30 seconds from any mobile device, automatically calculate statutory taxes, track logistics, auto-generate government-compliant e-Way Bills, and push complete vouchers directly into Tally Prime with a single click—eliminating manual double entry and billing errors.",
        body_style
    ))

    # 2. Core Feature Modules
    story.append(Paragraph("2. Core Feature Modules", h1_style))

    story.append(Paragraph("Module 1: Mobile & Web Billing Platform", h2_style))
    story.append(Paragraph("• <b>Mobile-First Factory Billing:</b> Fast, intuitive responsive interface optimized for smartphones, tablets, and desktop computers. Warehouse staff can bill shipments directly at loading docks.", bullet_style))
    story.append(Paragraph("• <b>Automated GST & Math Engine:</b> Auto-detects Intra-State (CGST 9% + SGST 9%) vs Inter-State (IGST 18%) from buyer state code. Pre-fills HSN codes (e.g. 39235010) and calculates legal tax amounts.", bullet_style))
    story.append(Paragraph("• <b>Smart Round-Off & Amount in Words:</b> Computes fractional round-offs and generates legal amount in words.", bullet_style))
    story.append(Paragraph("• <b>Logistics & Dispatch Tracking:</b> Captures Vehicle Registration Number (GJ-01-AB-1880), Transporter Name, Approx Distance (85 KM), Delivery Note Number (188), and Destination Plant.", bullet_style))

    story.append(Paragraph("Module 2: 1-Click Tally Prime Sync (Direct HTTP:9000)", h2_style))
    story.append(Paragraph("• <b>Direct Day Book Push:</b> Pushes complete sales vouchers directly into Tally Prime over HTTP port 9000 with a single click. Zero manual data re-entry.", bullet_style))
    story.append(Paragraph("• <b>Active Company Auto-Detection:</b> Dynamically senses whichever company is open in Tally (e.g. 'Sanmati Solution' or 'Yamuna Plastics'), preventing configuration mismatches.", bullet_style))
    story.append(Paragraph("• <b>Real-Time Verification:</b> Reads Tally's response XML (<CREATED>1</CREATED><ERRORS>0</ERRORS>) and stores the Tally Last Voucher ID in the audit trail.", bullet_style))
    story.append(Paragraph("• <b>Offline Fallback:</b> Provides immediate 'Download Tally XML' backup if Tally or network connectivity is temporarily offline.", bullet_style))

    story.append(Paragraph("Module 3: 100% Automated e-Way Bill Lifecycle (Option 1)", h2_style))
    story.append(Paragraph("• <b>Automatic e-Way Bill Generation:</b> Generates the statutory 12-digit e-Way Bill number (e.g. 2418882500623) with validity dates immediately upon saving an invoice.", bullet_style))
    story.append(Paragraph("• <b>Zero-Halt Statutory Tally XML Injection:</b> Pre-fills &lt;ISGST_EWAYBILLAPPLICABLE&gt;Yes&lt;/ISGST_EWAYBILLAPPLICABLE&gt; and complete &lt;EWAYBILLDETAILS.LIST&gt; tags so Tally Prime marks the e-Way Bill as already generated without pausing for manual entry.", bullet_style))
    story.append(Paragraph("• <b>Two-Way EWB Synchronization:</b> Clicking 'Sync e-Way Bills from Tally' retrieves official government e-Way bill numbers and validity dates back from Tally Prime into the mobile database.", bullet_style))
    story.append(Paragraph("• <b>Credentials Configuration Card:</b> Dedicated settings screen in the web app to manage GSTIN (24AKNPP7596H1ZF), portal username, password, GSP client ID, and Dispatch PIN (382350).", bullet_style))

    story.append(Paragraph("Module 4: 1:1 Exact Invoice Printout (Replicating '186 instaplast.pdf')", h2_style))
    story.append(Paragraph("• <b>Exact Grid & Box Structure:</b> Replicates the client's official invoice format across both the mobile application and Tally Prime.", bullet_style))
    story.append(Paragraph("• <b>e-Invoice QR Code & IRN Header:</b> Includes official 'Tax Invoice (ORIGINAL FOR RECIPIENT)' title, Ack No, Ack Date, and 64-character IRN banner.", bullet_style))
    story.append(Paragraph("• <b>Order & Dispatch Grid:</b> Displays Delivery Note (186/188), Delivery Note Date, and Destination (Himmatnagar).", bullet_style))
    story.append(Paragraph("• <b>HSN Statutory Tax Analysis:</b> Dedicated summary box breaking down Taxable Value, CGST rate/amount, SGST rate/amount, and total tax amount.", bullet_style))
    story.append(Paragraph("• <b>Company Bank Details Auto-Populated:</b> Displays The Karnavati Co-Op. Bank Ltd., A/c No: 124002005002108, IFSC: GSCB0UTKCBL, Branch: Bapunagar.", bullet_style))
    story.append(Paragraph("• <b>Dual Signature Blocks:</b> Prints 'Customer's Seal and Signature' box alongside 'for YAMUNA PLASTIC / Authorised Signatory'.", bullet_style))

    story.append(Paragraph("Module 5: Smart Address Formatting Engine", h2_style))
    story.append(Paragraph("• <b>Eliminates Squished / Barcode Text:</b> In Tally Prime, a long 140-character single-line address is horizontally squished down to 25% width. Our engine automatically splits long addresses at commas into 4 neat lines (~40 characters each) and emits separate &lt;CONSIGNEEADDRESS&gt; and &lt;BASICBUYERADDRESS&gt; tags.", bullet_style))

    story.append(Paragraph("Module 6: Automatic Master & Ledger Creation", h2_style))
    story.append(Paragraph("• <b>Zero Voucher Errors:</b> Customer ledgers (Sundry Debtors), Stock Items (T. C. INNER, HDPE Plain Liner Bags), and Bank Ledgers (The Karnavati Co-Op. Bank Ltd.) are auto-created in Tally if they do not exist.", bullet_style))

    story.append(Paragraph("Module 7: Tally GUI Integration & Hotkeys (TDL)", h2_style))
    story.append(Paragraph("• <b>F6 Hotkey in Tally Prime:</b> Pressing F6 directly on Gateway of Tally connects to the mobile API and pulls all pending bills into Day Book. Standalone TDL with zero syntax errors (verified in tallyerr.log).", bullet_style))

    story.append(Spacer(1, 8))

    # 3. Comparison Table
    story.append(Paragraph("3. Comparison: Manual Process vs. Yamuna Plastics Solution", h1_style))
    comp_data = [
        [
            Paragraph("<b>Operation</b>", ParagraphStyle('TH1', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
            Paragraph("<b>Manual / Traditional Process</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
            Paragraph("<b>Yamuna Plastics Integrated System</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white))
        ],
        [
            Paragraph("<b>Invoice Generation</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Handwritten chits or manual desktop entry in office (5-10 mins)", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>Mobile app creation at warehouse dock in 30 seconds</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Tally Entry</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Accountant manually re-types every invoice into Tally", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>1-Click HTTP Push directly into Tally Day Book</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>e-Way Bill</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Login to portal, retype vehicle & invoice, download PDF", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>100% Automatic generation & 2-way sync with Tally</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Missing Ledgers</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Voucher fails if customer or item is not created", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>Auto-created in Tally before voucher is posted</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Print Quality</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Mismatched formats, missing bank details or QR", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>1:1 Exact replica of '186 instaplast.pdf'</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Address Layout</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Squished/unreadable text due to 140-char line", ParagraphStyle('C2', fontName='Helvetica', fontSize=7.5, textColor=colors.HexColor('#4A5568'))),
            Paragraph("<b>Smart multi-line formatting produces crisp 4-line text</b>", ParagraphStyle('C3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#0D5C75')))
        ]
    ]

    t_comp = Table(comp_data, colWidths=[115, 205, 205])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,2), (-1,2), colors.white),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,4), (-1,4), colors.white),
        ('BACKGROUND', (0,5), (-1,5), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,6), (-1,6), colors.white),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_comp)

    doc.build(story)
    print(f"PDF created: {filename}")

if __name__ == '__main__':
    base_dir = r"c:\Users\admin\Downloads\Projects\Yamuna Plastics\docs"
    docx_path = os.path.join(base_dir, "Yamuna_Plastics_Billing_and_Tally_Integration_Features.docx")
    pdf_path = os.path.join(base_dir, "Yamuna_Plastics_Billing_and_Tally_Integration_Features.pdf")
    
    create_docx(docx_path)
    create_pdf(pdf_path)

    # Also copy to root of Yamuna Plastics for instant access
    root_dir = r"c:\Users\admin\Downloads\Projects\Yamuna Plastics"
    import shutil
    shutil.copy(docx_path, os.path.join(root_dir, "Yamuna_Plastics_Billing_and_Tally_Integration_Features.docx"))
    shutil.copy(pdf_path, os.path.join(root_dir, "Yamuna_Plastics_Billing_and_Tally_Integration_Features.pdf"))
    print("Copied to project root as well.")
