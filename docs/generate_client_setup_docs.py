import os
import shutil
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

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

    # Standard margins (0.75 in)
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Document Header
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("YAMUNA PLASTICS")
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(24)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(27, 54, 93) # Deep Navy

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("Live Production Setup & Tally TDL Integration Guide\nStandard Operating Procedure: Live Cloud Web Portal & Client PC Tally Prime")
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(13)
    r_sub.font.bold = True
    r_sub.font.color.rgb = RGBColor(74, 85, 104)

    # Metadata Banner Table
    meta_table = doc.add_table(rows=1, cols=3)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    col_widths = [Inches(2.3), Inches(2.3), Inches(2.4)]
    
    headers = [
        ("Deployment Model", "Live Cloud Web Portal + Single TDL"),
        ("Mobile Access", "24/7 Global Access via Phone Browser"),
        ("Tally Compatibility", "TallyPrime 2.x - 5.0 (Auto e-Way Bill)")
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

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(13.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(27, 54, 93)
        return p

    def add_bullet(p, bold_prefix, text):
        r_b = p.add_run(f"• {bold_prefix}: ")
        r_b.font.bold = True
        r_b.font.size = Pt(9.5)
        r_b.font.color.rgb = RGBColor(45, 55, 72)
        r_t = p.add_run(f"{text}\n")
        r_t.font.size = Pt(9.5)
        r_t.font.color.rgb = RGBColor(74, 85, 104)

    # 1. Live Cloud Web Portal
    add_h1("1. Live Cloud Web Portal (Mobile Access Anywhere)")
    p_arch = doc.add_paragraph()
    r = p_arch.add_run(
        "Once deployed, the Yamuna Plastics billing application operates 24/7 on your live cloud web domain "
        "(e.g. https://billing.yamunaplastics.com). Factory floor staff, dispatch supervisors, drivers, and sales personnel "
        "access the portal directly from their smartphone or tablet browser over 4G/5G mobile data or Wi-Fi. Invoices are saved "
        "instantly to the central cloud database and queued for synchronization into Tally Prime."
    )
    r.font.size = Pt(9.5)
    r.font.color.rgb = RGBColor(45, 55, 72)

    p_endpoints = doc.add_paragraph()
    add_bullet(p_endpoints, "Live Web Portal URL", "https://<YOUR-LIVE-DOMAIN>/ (Mobile-responsive billing interface)")
    add_bullet(p_endpoints, "Tally XML Sync Endpoint", "https://<YOUR-LIVE-DOMAIN>/api/tally/export-xml (Real-time XML generator)")
    add_bullet(p_endpoints, "Cloud System Status", "https://<YOUR-LIVE-DOMAIN>/api/tally/status (Live server health monitor)")

    # 2. Client PC Setup: Single TDL
    add_h1("2. Client PC Setup: Single TDL Installation (2 Minutes)")
    p_setup_intro = doc.add_paragraph()
    r_si = p_setup_intro.add_run(
        "On the client's accounting computer running Tally Prime, NO source code, NO Node.js, and NO developer tools are installed. "
        "Only the single certified TDL file (YamunaPlastics_Sync.tdl) is placed on the computer."
    )
    r_si.font.size = Pt(9.5)
    r_si.font.color.rgb = RGBColor(45, 55, 72)

    p_step = doc.add_paragraph()
    add_bullet(p_step, "Step 1 - Copy Single File", "Place 'YamunaPlastics_Sync.tdl' into C:\\TallyPrime\\YamunaPlastics_Sync.tdl (or any preferred folder).")
    add_bullet(p_step, "Step 2 - Load TDL in Tally Prime", "In Tally Prime, press F1: Help > TDLs & Add-Ons > F4: Manage Local TDLs. Set 'Load selected TDL files on startup' to Yes. Add the path 'C:\\TallyPrime\\YamunaPlastics_Sync.tdl'. Save with Ctrl+A. Verify bottom-right shows '1 of 1 TDLs loaded (0 errors)'.")
    add_bullet(p_step, "Step 3 - Set Live Cloud URL (One-Time)", "Go to Gateway of Tally > 'Yamuna Plastics Mobile Sync' > 'Configure Live Cloud Portal URL'. Enter your live cloud URL (e.g. https://billing.yamunaplastics.com). Save with Ctrl+A. Tally saves this setting permanently.")

    # 3. Daily Accountant Workflow
    add_h1("3. Daily Accountant Workflow in Tally Prime")
    p_daily = doc.add_paragraph()
    add_bullet(p_daily, "Method 1: Direct 1-Click Sync (F6)", "The accountant opens Tally Prime, goes to Gateway of Tally > 'Yamuna Plastics Mobile Sync' > 'Sync All Pending Bills from Live Portal' (or presses F6). Tally connects over secure outbound HTTPS to the live cloud portal, downloads all pending bills, and automatically opens the Sales Day Book with vouchers posted.")
    add_bullet(p_daily, "Method 2: Offline / Manual XML Fallback (F7)", "If the client PC temporarily has restricted internet: open the live cloud portal in any browser, click 'Export to Tally XML' (saves YamunaPlastics_Import.xml), and in Tally Prime press F7: Import File.")

    # 4. Tally Open vs Closed Mode
    add_h1("4. Important: Does Tally Prime Need to Be Open?")
    p_open_rule = doc.add_paragraph()
    add_bullet(p_open_rule, "Mobile Billing Works 24/7 (Even if Tally is Closed)", "Factory staff, drivers, and sales team can create bills on their phones at any time of day or night. Tally does NOT need to be open on the PC for mobile billing to work. All bills are stored safely in the cloud with status 'Pending Tally Sync'. Zero bills are ever lost.")
    add_bullet(p_open_rule, "Tally Must Be Open to Receive Invoices", "Tally Prime's database engine only accepts new vouchers when the Tally application is open and the Yamuna Plastics company is loaded. Windows cannot write into Tally's ledger files while Tally is closed.")
    add_bullet(p_open_rule, "Automatic Batch Catch-Up on Opening (F6)", "Whenever the accountant opens Tally Prime (in the morning, afternoon, or once daily), pressing F6 pulls ALL accumulated bills created while Tally was closed in one single shot.")
    add_bullet(p_open_rule, "Recommended Setup for Always-Ready Sync", "Leave Tally Prime minimized on the taskbar during business hours, or add Tally Prime to the Windows Startup folder (shell:startup) so Tally launches automatically whenever the PC powers on.")

    # 5. Automatic e-Way Bill Integration
    add_h1("5. Automatic e-Way Bill Integration (Zero-Click in Tally)")
    p_eway = doc.add_paragraph()
    add_bullet(p_eway, "No Interactive Confirmation Popups", "In latest TallyPrime (3.0, 4.0, 5.0), manual voucher entry normally prompts: 'Do you want to generate e-Way Bill? [Yes/No]' and waits for a button click.")
    add_bullet(p_eway, "100% Automated by Cloud Sync", "When bills are created on the mobile app, our system automatically packages all statutory transport data: 12-digit e-Way Bill No, Vehicle No, Transporter Name, Distance in KM, Delivery Pincode, and Status Tag <EWBSTATUS>Generated</EWBSTATUS>.")
    add_bullet(p_eway, "Auto-Recognized as Generated in Tally", "When Tally Prime imports via F6, it sees that <EWAYBILLNO> is already populated. Tally recognizes the e-Way Bill as already active and NEVER asks the accountant to click any button!")
    add_bullet(p_eway, "Prints Automatically on Invoice", "The 12-digit e-Way Bill number displays automatically in the print preview and physical printout matching 186 instaplast.pdf.")
    add_bullet(p_eway, "One-Time Tally Feature Setting", "In TallyPrime, press F11: Features > Enable Goods and Services Tax (GST) > set 'Send e-Way Bill details with Sales voucher' to No. This guarantees Tally will not interrupt with manual generation prompts.")

    # 6. Tally Print Configuration
    add_h1("6. Tally Print Configuration (Matching 186 instaplast.pdf)")
    p_prt_intro = doc.add_paragraph()
    r_pi = p_prt_intro.add_run(
        "To ensure invoices printed from Tally Prime perfectly match the official 2-page Instaplast standard (186 instaplast.pdf):"
    )
    r_pi.font.size = Pt(9.5)
    r_pi.font.color.rgb = RGBColor(45, 55, 72)

    prt_table = doc.add_table(rows=8, cols=3)
    prt_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    prt_table.autofit = False
    prt_widths = [Inches(2.2), Inches(2.2), Inches(2.6)]
    prt_headers = ["Print Configuration Field", "Required Setting", "Operational Purpose"]

    for c_idx, h_text in enumerate(prt_headers):
        cell = prt_table.cell(0, c_idx)
        cell.width = prt_widths[c_idx]
        set_cell_background(cell, "1B365D")
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        p = cell.paragraphs[0]
        run = p.add_run(h_text)
        run.font.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)

    prt_rows = [
        ("Printer Selection", "Microsoft Print to PDF / A4 Laser", "Enforces full A4 page width (do NOT use POS thermal printers)."),
        ("Print in Simple Format", "No", "Enforces the official structured box-grid layout."),
        ("Show Place of Supply", "Yes", "Prints 'Place of Supply : Gujarat (24)'."),
        ("Show Bank Details", "Yes", "Displays Karnavati Co-Op Bank, A/c & IFSC box at bottom-right."),
        ("Show A/c Holder's Name", "Yes", "Prints 'YAMUNA PLASTIC' above bank account details."),
        ("Show Customer's Seal & Sign", "Yes", "Prints the bottom customer authorization box."),
        ("Show Address in continuous line", "Yes", "Prevents address squishing by wrapping long lines cleanly.")
    ]

    for r_idx, (col1, col2, col3) in enumerate(prt_rows, start=1):
        bg = "F9FBFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate([col1, col2, col3]):
            cell = prt_table.cell(r_idx, c_idx)
            cell.width = prt_widths[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            p = cell.paragraphs[0]
            run = p.add_run(val)
            run.font.size = Pt(8.5)
            if c_idx == 0:
                run.font.bold = True
                run.font.color.rgb = RGBColor(27, 54, 93)
            elif c_idx == 1:
                run.font.bold = True
                run.font.color.rgb = RGBColor(13, 92, 117)
            else:
                run.font.color.rgb = RGBColor(74, 85, 104)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 7. Testing Protocol Table
    add_h1("7. Live End-to-End Testing & Verification Protocol (6 Steps)")
    table = doc.add_table(rows=7, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    t_widths = [Inches(1.0), Inches(3.0), Inches(3.0)]
    headers_t = ["Step #", "Action to Perform", "Expected Result & Verification"]
    
    for c_idx, h_text in enumerate(headers_t):
        cell = table.cell(0, c_idx)
        cell.width = t_widths[c_idx]
        set_cell_background(cell, "1B365D")
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        p = cell.paragraphs[0]
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    test_steps = [
        ("Step 1", "Open Live URL on Smartphone (4G/5G/Wi-Fi)", "Open live cloud URL (https://billing.yamunaplastics.com). Mobile billing interface loads cleanly."),
        ("Step 2", "Create Test Bill on Mobile Phone", "Select 'INSTAPLAST INDIA', item 'T. C. INNER', Vehicle GJ-01-AB-1880, tap 'Save Invoice & Generate Bill'."),
        ("Step 3", "Open Tally Prime on Client PC", "Client opens Tally Prime with Yamuna Plastics company active. Gateway shows 'Yamuna Plastics Mobile Sync'."),
        ("Step 4", "Press F6: Sync API inside Tally Prime", "Tally connects over HTTPS to cloud, imports voucher with active e-Way Bill (zero prompts/clicks)."),
        ("Step 5", "Verify Sales Voucher in Tally Day Book", "Voucher appears in Day Book with correct party, items, HSN 39235010, and CGST 9% + SGST 9% tax breakdown."),
        ("Step 6", "Verify Print Preview in Tally (Ctrl + P > I)", "Preview displays full A4 box layout with e-Way Bill No., bank details, QR code, and signature blocks.")
    ]

    for r_idx, (col1, col2, col3) in enumerate(test_steps, start=1):
        bg = "F9FBFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate([col1, col2, col3]):
            cell = table.cell(r_idx, c_idx)
            cell.width = t_widths[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(8.5)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = RGBColor(27, 54, 93)
            elif c_idx == 2:
                r.font.color.rgb = RGBColor(13, 92, 117)
            else:
                r.font.color.rgb = RGBColor(45, 55, 72)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 8. Troubleshooting
    add_h1("8. Troubleshooting & FAQ")
    p_tr = doc.add_paragraph()
    add_bullet(p_tr, "TDL Not Loaded in Tally", "Check path in F1 > TDLs & Add-Ons > F4: Manage Local TDLs. Verify file exists at C:\\TallyPrime\\YamunaPlastics_Sync.tdl.")
    add_bullet(p_tr, "Sync Shows Connection Error", "Verify client PC has active internet. In Tally, open Gateway > Yamuna Plastics Mobile Sync > Configure Live Cloud Portal URL and ensure URL starts with https://.")
    add_bullet(p_tr, "Tally Prompts to Generate e-Way Bill", "In Tally F11 > GST, set 'Send e-Way Bill details with Sales voucher' to No. The sync already provides the active e-Way Bill.")
    add_bullet(p_tr, "Bills Made While Tally Closed Not Showing", "Press F6 in Tally Prime. All accumulated bills created while Tally was closed will download in one batch.")

    doc.save(filename)
    print(f"DOCX created: {filename}")

def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=28,
        rightMargin=28,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1B365D'),
        alignment=TA_CENTER,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#4A5568'),
        alignment=TA_CENTER,
        spaceAfter=6
    )

    h1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=colors.HexColor('#1B365D'),
        spaceBefore=5,
        spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.8,
        leading=9.2,
        textColor=colors.HexColor('#2D3748'),
        spaceAfter=1.5,
        leftIndent=8
    )

    story = []

    story.append(Paragraph("YAMUNA PLASTICS", title_style))
    story.append(Paragraph("Live Production Setup & Tally TDL Integration Guide<br/><b>Standard Operating Procedure: Live Cloud Web Portal & Client PC Tally Prime</b>", subtitle_style))

    # Meta banner
    meta_data = [
        [
            Paragraph("<b>Deployment Model:</b><br/>Live Cloud Web Portal + Single TDL", ParagraphStyle('M1', fontName='Helvetica', fontSize=6.8, leading=8.8, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D'))),
            Paragraph("<b>Mobile Access:</b><br/>24/7 Global Access via Phone Browser", ParagraphStyle('M2', fontName='Helvetica', fontSize=6.8, leading=8.8, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D'))),
            Paragraph("<b>Tally Compatibility:</b><br/>TallyPrime 2.x - 5.0 (Auto e-Way Bill)", ParagraphStyle('M3', fontName='Helvetica', fontSize=6.8, leading=8.8, alignment=TA_CENTER, textColor=colors.HexColor('#1B365D')))
        ]
    ]
    t_meta = Table(meta_data, colWidths=[180, 180, 180])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0F4F8')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 2))

    # 1. Live Cloud Web Portal
    story.append(Paragraph("1. Live Cloud Web Portal (Mobile Access Anywhere)", h1_style))
    story.append(Paragraph("• <b>Global Mobile Access:</b> Operates 24/7 on live cloud hosting (e.g. https://billing.yamunaplastics.com). Staff and drivers create bills and print dispatch slips on their mobile browsers over 4G/5G/Wi-Fi.", bullet_style))
    story.append(Paragraph("• <b>Live Cloud Endpoints:</b> Web App: <b>https://&lt;YOUR-LIVE-DOMAIN&gt;/</b> | Tally XML API: <b>/api/tally/export-xml</b> | Health Status: <b>/api/tally/status</b>.", bullet_style))

    # 2. Client Setup Steps
    story.append(Paragraph("2. Client PC Setup: Single TDL Installation (2 Minutes — Zero Code)", h1_style))
    story.append(Paragraph("• <b>Zero Code Footprint:</b> No source code, Node.js, Git, or terminal commands on client PC. Exactly ONE file is placed: <b>YamunaPlastics_Sync.tdl</b>.", bullet_style))
    story.append(Paragraph("• <b>Step 1 - Copy File:</b> Place <b>YamunaPlastics_Sync.tdl</b> into <b>C:\\TallyPrime\\YamunaPlastics_Sync.tdl</b>.", bullet_style))
    story.append(Paragraph("• <b>Step 2 - Load in Tally:</b> Press <b>F1: Help</b> &gt; <b>TDLs & Add-Ons</b> &gt; <b>F4: Manage Local TDLs</b>. Set 'Load selected TDL files on startup' to <b>Yes</b>. Add file path. Save with <b>Ctrl + A</b>.", bullet_style))
    story.append(Paragraph("• <b>Step 3 - Set Live URL:</b> Gateway of Tally &gt; <b>Yamuna Plastics Mobile Sync</b> &gt; <b>Configure Live Cloud Portal URL</b>. Enter your live URL (e.g. https://billing.yamunaplastics.com). Save with <b>Ctrl + A</b>.", bullet_style))

    # 3. Daily Accountant Workflow
    story.append(Paragraph("3. Daily Accountant Workflow in Tally Prime", h1_style))
    story.append(Paragraph("• <b>Method 1 (Direct F6 Sync):</b> Open Tally Prime. Press <b>F6</b> from the sync menu. Tally connects over HTTPS and imports all pending vouchers directly into Sales Day Book.", bullet_style))
    story.append(Paragraph("• <b>Method 2 (Offline XML Fallback):</b> Open cloud portal &gt; Invoices &gt; Click 'Export to Tally XML' &gt; In Tally Prime, press <b>F7: Import File</b>.", bullet_style))

    # 4. Tally Open vs Closed Mode
    story.append(Paragraph("4. Important: Does Tally Prime Need to Be Open to Sync Bills?", h1_style))
    story.append(Paragraph("• <b>Mobile Billing Works 24/7 (Even if Tally is Closed):</b> Mobile staff continue billing normally. Bills queue safely in the cloud with status 'Pending Tally Sync'. Zero bills are lost.", bullet_style))
    story.append(Paragraph("• <b>Tally Must Be Open to Receive Invoices:</b> Tally Prime's database engine only accepts vouchers when Tally is running. Windows cannot write into closed Tally files.", bullet_style))
    story.append(Paragraph("• <b>Bulk Catch-Up on Launch (F6):</b> Whenever the accountant opens Tally Prime, pressing <b>F6</b> downloads ALL accumulated pending bills in one single shot.", bullet_style))

    # 5. Automatic e-Way Bill Generation
    story.append(Paragraph("5. Automatic e-Way Bill Integration (Zero-Click in Tally)", h1_style))
    story.append(Paragraph("• <b>Zero-Click in Latest TallyPrime:</b> In manual entry, TallyPrime (3.x/4.x/5.0) normally asks 'Do you want to generate e-Way Bill? [Yes/No]' and waits for a click. With our sync, this is 100% AUTOMATIC!", bullet_style))
    story.append(Paragraph("• <b>Pre-Populated Statutory Data:</b> The sync XML supplies the 12-digit e-Way Bill number, vehicle number, transporter ID, distance, pincode, and status tag &lt;EWBSTATUS&gt;Generated&lt;/EWBSTATUS&gt;.", bullet_style))
    story.append(Paragraph("• <b>No Prompts or Popups:</b> Tally sees that &lt;EWAYBILLNO&gt; is already active, treats the e-Way Bill as already generated, and NEVER asks the user to click any button!", bullet_style))
    story.append(Paragraph("• <b>F11 Setting Tip:</b> In TallyPrime, press <b>F11: Features</b> &gt; <b>GST</b> &gt; set 'Send e-Way Bill details with Sales voucher' to <b>No</b> to prevent interactive prompts.", bullet_style))

    # 6. Tally Print Setup
    story.append(Paragraph("6. Tally Print Configuration (Matching 186 instaplast.pdf)", h1_style))
    story.append(Paragraph("• <b>Open Print Config:</b> Gateway of Tally &gt; Day Book &gt; Open Sales Voucher &gt; <b>Ctrl + P</b> &gt; <b>C (Configure)</b>.", bullet_style))
    story.append(Paragraph("• <b>Printer:</b> Set to 'Microsoft Print to PDF' or A4 Laser Printer (NOT thermal receipt printer).", bullet_style))
    story.append(Paragraph("• <b>Key Tally Switches:</b> Set 'Show Bank details: Yes' (Karnavati Co-Op Bank Ltd), 'Show Place of Supply: Yes', 'Show Customer's Seal & Signature: Yes', and 'Show Address in a continuous line: Yes'.", bullet_style))

    # 7. Testing Protocol Table
    story.append(Paragraph("7. Live End-to-End Testing & Verification Protocol (6 Steps)", h1_style))
    test_data = [
        [
            Paragraph("<b>Step</b>", ParagraphStyle('TH1', fontName='Helvetica-Bold', fontSize=6.2, textColor=colors.white)),
            Paragraph("<b>Action to Perform</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=6.2, textColor=colors.white)),
            Paragraph("<b>Expected Verification</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=6.2, textColor=colors.white))
        ],
        [
            Paragraph("<b>Step 1</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Open Live URL on Phone (4G/5G/Wi-Fi)", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Open live cloud portal. Responsive UI displays dashboard & bill form.", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Step 2</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Create Test Bill on Mobile Phone", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Select INSTAPLAST INDIA, item T. C. INNER, vehicle GJ-01-AB-1880, tap Save.", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Step 3</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Open Tally Prime on Client PC", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Yamuna Plastics company open. Gateway displays 'Yamuna Plastics Mobile Sync'.", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Step 4</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Press F6: Sync API inside Tally Prime", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Tally imports voucher with e-Way Bill attached (zero popups or clicks).", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Step 5</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Check Tally Prime Sales Day Book", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Voucher appears in Day Book with correct party, items, and CGST/SGST taxes.", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ],
        [
            Paragraph("<b>Step 6</b>", ParagraphStyle('C1', fontName='Helvetica-Bold', fontSize=5.8, textColor=colors.HexColor('#1B365D'))),
            Paragraph("Check Print Preview (Ctrl + P > I)", ParagraphStyle('C2', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#2D3748'))),
            Paragraph("Preview matches 186 instaplast.pdf (e-Way Bill No., Bank, QR, HSN table).", ParagraphStyle('C3', fontName='Helvetica', fontSize=5.8, textColor=colors.HexColor('#0D5C75')))
        ]
    ]

    t_test = Table(test_data, colWidths=[55, 240, 245])
    t_test.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1B365D')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,2), (-1,2), colors.white),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,4), (-1,4), colors.white),
        ('BACKGROUND', (0,5), (-1,5), colors.HexColor('#F9FBFC')),
        ('BACKGROUND', (0,6), (-1,6), colors.white),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
    ]))
    story.append(t_test)
    story.append(Spacer(1, 2))

    # 8. Troubleshooting
    story.append(Paragraph("8. Troubleshooting & FAQ", h1_style))
    story.append(Paragraph("• <b>TDL Not Loaded:</b> Verify file path in F1 &gt; TDLs & Add-Ons &gt; F4. Ensure file exists at C:\\TallyPrime\\YamunaPlastics_Sync.tdl.", bullet_style))
    story.append(Paragraph("• <b>Could Not Connect to API:</b> Verify client PC has internet access. Check Gateway &gt; Yamuna Plastics Mobile Sync &gt; Configure Live Cloud Portal URL.", bullet_style))
    story.append(Paragraph("• <b>Tally Asks to Generate e-Way Bill:</b> In Tally F11 &gt; GST, set 'Send e-Way Bill details with Sales voucher' to No. The sync already provides active e-Way Bill details.", bullet_style))

    doc.build(story)
    print(f"PDF created: {filename}")

if __name__ == '__main__':
    base_dir = r"c:\Users\admin\Downloads\Projects\Yamuna Plastics\docs"
    docx_path = os.path.join(base_dir, "Yamuna_Plastics_Client_PC_Setup_and_Testing_Guide.docx")
    pdf_path = os.path.join(base_dir, "Yamuna_Plastics_Client_PC_Setup_and_Testing_Guide.pdf")

    create_docx(docx_path)
    create_pdf(pdf_path)

    # Copy to root of project if not locked
    root_dir = r"c:\Users\admin\Downloads\Projects\Yamuna Plastics"
    try:
        shutil.copy(docx_path, os.path.join(root_dir, "Yamuna_Plastics_Client_PC_Setup_and_Testing_Guide.docx"))
        print("DOCX copied to project root.")
    except Exception as e:
        print(f"Note: Root DOCX is currently open in Word: {e}")
    try:
        shutil.copy(pdf_path, os.path.join(root_dir, "Yamuna_Plastics_Client_PC_Setup_and_Testing_Guide.pdf"))
        print("PDF copied to project root.")
    except Exception as e:
        print(f"Note: Root PDF copy: {e}")
