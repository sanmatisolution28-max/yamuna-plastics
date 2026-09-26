# 🏭 Yamuna Plastics · Mobile Billing & Tally TDL Integration Suite

A complete enterprise-grade mobile billing and accounting integration suite purpose-built for **Yamuna Plastics Pvt. Ltd.** (Polyethylene packaging, HDPE/LDPE liners, PP woven sacks, and polymer granules manufacturing).

---

## 🌟 Key Features

1. **📱 Mobile Billing Application**:
   - Modern, touch-optimized mobile billing application (runs seamlessly on smartphones, tablets, or desktop browsers).
   - Realistic mobile phone simulator frame with 1-click toggle to full-screen view.
   - **Bill Generate Form**:
     - Customer auto-completion with GSTIN, State code, and address.
     - Dynamic product lines with plastics product catalog (HDPE bags, LDPE rolls, PP sacks, polymer granules).
     - Auto-filling HSN codes, UOM (KGS, BAGS, ROLLS, PCS), rates, and GST percentages.
     - Intelligent GST calculation: Auto-detects Intra-state (CGST + SGST) vs Inter-state (IGST 18%).
     - Real-time row and grand totals with Indian currency words conversion and auto round-off.
     - 1-Click **"Generate Tax Invoice"** and **"Generate & Sync to Tally"**.
2. **📄 Official GST Tax Invoice Generator**:
   - Printable GST Tax Invoice layout conforming to Indian GST specifications.
   - Itemized HSN summary, CGST/SGST/IGST breakdown, bank details for RTGS/NEFT, and authorized signatory.
   - Print to paper / Save as PDF with clean `@media print` styling.
3. **🔌 Direct Tally Prime & Tally.ERP 9 Integration**:
   - **Method A (Direct 1-Click Push)**: Pushes bills directly from the mobile app to Tally Prime over Port 9000.
   - **Method B (Tally TDL Menu)**: Custom TDL definition adding *"Yamuna Plastics Mobile Sync"* directly to Gateway of Tally (`F6: Sync from API`).
   - **Method C (Offline XML Export)**: Download compliant `<ENVELOPE>` XML and import via `Alt + O > Transactions`.
   - Auto-creates Party Ledgers (Sundry Debtors) and Stock Items in Tally if they do not already exist.
4. **📚 Comprehensive Documentation**:
   - Step-by-step Tally integration guide ([`docs/TALLY_INTEGRATION_GUIDE.md`](file:///c:/Users/admin/Downloads/Projects/Yamuna%20Plastics/docs/TALLY_INTEGRATION_GUIDE.md)).
   - Technical TDL code explanation ([`docs/TDL_CODE_EXPLANATION.md`](file:///c:/Users/admin/Downloads/Projects/Yamuna%20Plastics/docs/TDL_CODE_EXPLANATION.md)).

---

## 📁 Project Directory Structure

```
Yamuna Plastics/
├── client/                     # Mobile-first React + Vite application
│   ├── src/
│   │   ├── components/         # BillForm, BillList, InvoiceModal, TallySync, PartyMaster, ItemCatalog
│   │   ├── utils/              # api.js, numberToWords.js, gst.js
│   │   ├── App.jsx             # Main mobile view with bottom navigation
│   │   └── index.css           # Modern industrial styling & print styles
│   ├── package.json
│   └── vite.config.js          # Port 5173 with proxy to backend
├── server/                     # Node.js Express REST API & Tally XML Engine
│   ├── index.js                # Port 5005 server
│   ├── routes/                 # invoices.js, tally.js, masters.js
│   ├── lib/
│   │   └── tallyXmlBuilder.js  # Standard Tally <ENVELOPE> XML generator
│   ├── data/                   # invoices.json, parties.json, items.json, settings.json
│   └── package.json
├── tdl/                        # Tally Definition Language files
│   ├── YamunaPlastics_Sync.tdl # TDL to load into Tally Prime / ERP 9
│   └── YamunaPlastics_Import.xml # Pre-built sample XML for manual import
├── docs/                       # Integration Documentation
│   ├── TALLY_INTEGRATION_GUIDE.md # Complete step-by-step Tally setup instructions
│   └── TDL_CODE_EXPLANATION.md # TDL syntax and function reference
├── run-dev.js                  # Starts client and server concurrently
├── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Start the API Server & Mobile Application
Open a terminal in `Yamuna Plastics`:
```bash
# Start both server (port 5005) and client (port 5173)
node run-dev.js
```
- **Mobile Web App**: Open [http://localhost:5173](http://localhost:5173) in your browser.
- **Backend API**: Running at [http://localhost:5005](http://localhost:5005).

---

### 2. Loading the TDL in Tally Prime
1. In Tally Prime, press **`F1: Help` &gt; `TDLs & Add-Ons`**.
2. Press **`F4: Manage Local TDLs`**.
3. Set **Load selected TDL files on startup?** to **`Yes`**.
4. Paste the path:
   ```text
   C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl
   ```
5. Press **`Ctrl + A`** to save.
6. Check Gateway of Tally: A new menu **`Yamuna Plastics Mobile Sync`** (HotKey: **`Y`**) is now active!

---

---

### 3. Generating a Bill & Syncing to Tally
1. On your mobile/browser, open [http://localhost:5173](http://localhost:5173).
2. On the **New Bill** tab, select a customer (e.g. *INSTAPLAST INDIA* or *Surat Textile Traders*).
3. Select your plastic items, enter quantities, and verify rates.
4. Click **`🔌 Generate & Sync to Tally`**.
5. Check your Tally Prime **Day Book** (`Gateway of Tally > Day Book`): The Sales Voucher is entered automatically with full ledgers, stock allocations, and GST taxes!

---

### 4. 📄 Real Invoice Case Study: `186 instaplast.pdf`

The application and TDL engine were customized and verified against your actual invoice `186 instaplast.pdf`:

- **Company / Seller**:
  - `YAMUNA PLASTIC`, 26, Patel Estate, Opp Muktidham Estate, Nikol Gam Road, Ahmedabad - 382350
  - GSTIN: `24AKNPP7596H1ZF`
  - Bank: The Karnavati Co-Op. Bank Ltd. (A/C `124002005002108`, IFSC `GSCB0UTKCBL`, Bapunagar Branch)
- **Buyer / Consignee**:
  - `INSTAPLAST INDIA`, Pioneer Industrial Estate, Ilol Road, Himmatnagar, Sabarkantha - Gujarat
  - GSTIN: `24BMZPB0466R1ZC` | State Code: `24` (Intra-state GST)
- **Invoice Particulars**:
  - Invoice No: `186` | Delivery Note: `186` | Destination: `Himmatnagar`
  - Item: `T. C. INNER` (HSN `39235010`)
  - Quantity: `30,000 PCS` @ `₹0.22/PCS` = `₹6,600.00`
  - Taxes: CGST 9% (`₹594.00`) + SGST 9% (`₹594.00`) = `₹1,188.00`
  - Grand Total: `₹7,788.00`
  - e-Invoice IRN: `fe04202eafe15c883dc080ef77eafda0f0652276ee128-244035dc46d766e6389`
  - Status in Tally: **Already successfully entered into Tally Prime (`Sanmati Solution`) Sales Register!**

---

### 5. ✏️ How to Edit / Update Any Bill and Alter in Tally

If you need to change anything on any bill (rates, quantity, items, customer, delivery note, transport details, vehicle no):

1. Go to the **📋 Bills** tab.
2. Find the invoice and click the **`✏️ Edit`** button.
3. The app enters **Editing Mode** with a blue notification banner indicating the invoice number being edited.
4. Modify any field (change product quantities, add more items, update vehicle number or destination).
5. Click either:
   - **`💾 Save & Update Bill`**: Updates the bill locally.
   - **`🔌 Update & Alter in Tally (1-Click)`**: Updates the bill locally and immediately sends an `<ENVELOPE ACTION="Alter">` voucher with `<OLDVOUCHERNUMBER>` to Tally Prime.
6. **Result in Tally**: Tally Prime immediately alters and updates the existing voucher in your Day Book and Sales Register without creating any duplicate entry!

---

### 6. 🚚 Automated e-Way Bill Lifecycle & Identification

The application and TDL suite are engineered to work with the **latest Tally Prime version** (TallyPrime 2.x, 3.x, 4.x, 5.x) with native automated e-Way Bill creation:

1. **Captured in Mobile Bill Form**:
   - Approx Distance (KM), Transporter Name & ID, Vehicle Number, Place of Delivery, Delivery Note & Date.
2. **Automated XML Parameters for Tally**:
   - Passes `<ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE>` and full `<EWAYBILLDETAILS.LIST>` with dispatch/destination PIN codes (`382350` Nikol / `383001` Himmatnagar) and transport details.
   - In modern Tally Prime, the voucher goes directly to **"Ready for e-Way Bill Generation"** without missing-data warnings.
   - In Tally Prime with online credentials configured, clicking **"Exchange > Send for e-Way Bill"** automatically generates the e-Way Bill number on the government portal.
3. **Automatic Storage & Identification in Mobile App**:
   - When a bill is pushed to Tally (or on clicking **`🚚 Get EWB`**), the app queries Tally over Port 9000, retrieves the e-Way Bill (`<EWAYBILLNO>`, `<EWAYBILLDATE>`, `<EWAYBILLVALIDTILL>`), and stores it directly into `server/data/invoices.json`.
   - **Vibrant Green Badge**: Each invoice displays `🚚 EWB: {ewbNo}` directly on the invoice card.
   - **Modal & Print**: Includes the prominent e-Way Bill banner and full tax invoice print layout matching `186 instaplast.pdf`.

---

### 7. 🛡️ Smooth Compatibility with Client's Latest Tally Version

- **100% Self-Contained TDL**: All sync logic and exact print formatting are merged into a single file `tdl/YamunaPlastics_Sync.tdl`.
- **Zero Include Conflicts**: No external relative include paths that can break when loaded from different folders.
- **Zero Syntax Errors**: Does not modify or delete standard Tally subforms, guaranteeing a clean log in `tallyerr.log`.
- **Non-Destructive Integration**: Safe for existing client companies, ledgers, vouchers, and tax configurations.

---

*Yamuna Plastics · Ahmedabad & Sarigam, Gujarat*
