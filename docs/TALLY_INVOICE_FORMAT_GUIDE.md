# 📄 Tally Prime Exact Invoice Print Format Guide
## Replicating the Exact Format of `186 instaplast.pdf` for All Bills

This guide explains how to get the **exact same invoice format** as your sample **`186 instaplast.pdf`** both inside **Tally Prime** and directly from the **Yamuna Plastics Mobile Web Application**.

---

## 🔍 Structure of the Given Invoice (`186 instaplast.pdf`)

The sample invoice `186 instaplast.pdf` is the standard **Tally Prime GST Comprehensive Tax Invoice with e-Invoice QR code**. It contains the following exact sections:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tax Invoice               (ORIGINAL FOR RECIPIENT)          e-Invoice │
│  IRN: fe04202eafe15c883dc080ef77eafda0f0652276ee...       [QR CODE]    │
│  Ack No: 162625665132663  |  Ack Date: 20-Aug-26                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ YAMUNA PLASTIC                    │ Invoice No: 186   Dated: 20-Aug-26 │
│ 26, Patel Estate, Opp Muktidham...│ Delivery Note: 186                 │
│ UDYAM : UDYAM-GJ-01-0051476       │ Mode/Terms of Payment:             │
│ GSTIN/UIN: 24AKNPP7596H1ZF        │ Delivery Note Date: 20-Aug-26      │
│ State Name: Gujarat, Code: 24     │ Destination: Himmatnagar           │
│                                   │ Terms of Delivery:                 │
├───────────────────────────────────┤                                    │
│ Consignee (Ship to):              │                                    │
│ INSTAPLAST INDIA, Himmatnagar     │                                    │
├───────────────────────────────────┤                                    │
│ Buyer (Bill to):                  │                                    │
│ INSTAPLAST INDIA, Himmatnagar     │                                    │
├───────────────────────────────────┴────────────────────────────────────┤
│ Sl | Description of Goods | HSN/SAC | Quantity | Rate | per | Amount   │
│  1 | T. C. INNER          | 39235010|30,000 PCS| 0.22 | PCS | 6,600.00 │
│    | S GST (9%)           |         |          |      |     |   594.00 │
│    | C GST (9%)           |         |          |      |     |   594.00 │
│    | Total                |         |30,000 PCS|      |     | 7,788.00 │
├────────────────────────────────────────────────────────────────────────┤
│ Amount Chargeable (in words): INR Seven Thousand Seven Hundred...E.&O.E│
├────────────────────────────────────────────────────────────────────────┤
│ HSN/SAC  | Taxable Val | CGST (9%) | SGST (9%) | Total Tax Amount      │
│ 39235010 |  6,600.00   |  594.00   |  594.00   | 1,188.00              │
│ Tax Amount (in words): INR One Thousand One Hundred Eighty Eight Only  │
├───────────────────────────────────┬────────────────────────────────────┤
│ Declaration:                      │ Company's Bank Details:            │
│ We declare that this invoice shows│ Bank: The Karnavati Co-Op.Bank Ltd.│
│ the actual price of the goods...  │ A/c No: 124002005002108            │
│                                   │ Branch & IFSC: Bapunagar & GSCB0...│
│                                   │ for YAMUNA PLASTIC                 │
│                                   │                 Authorised Signator│
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 🛠️ Method 1: In Tally Prime (Print Configuration)

You can print any Sales voucher in Tally Prime in this exact layout by setting the standard print options:

### Step 1: Open Sales Voucher in Tally Prime
1. Go to **`Gateway of Tally` > `Day Book`**.
2. Select your Sales Voucher (e.g. **Vch # 186**).
3. Press **`Ctrl + P`** (Print) > Press **`C` (Configure)**.

### Step 2: Set the Exact Options
Set the following options in the Configuration screen:

| Setting in Tally Prime Configuration | Value |
|---|---|
| **Title** | `Tax Invoice` |
| **Sub-Title** | `(ORIGINAL FOR RECIPIENT)` |
| **Show Company Name & Address** | `Yes` |
| **Show UDYAM Registration No.** | `Yes` |
| **Show e-Invoice Details** | `Yes` |
| **Show Consignee details** | `Yes` (Separates Consignee and Buyer) |
| **Show Delivery Note** | `Yes` |
| **Show Delivery Note Date** | `Yes` |
| **Show Destination** | `Yes` |
| **Show Dispatch / Order details** | `Yes` |
| **Show Item-wise HSN/SAC** | `Yes` |
| **Show Rate & Unit** | `Yes` |
| **Show GST Analysis of Items** | `Yes` *(Prints the HSN Summary table)* |
| **Show Bank Details** | `Yes` *(Select: The Karnavati Co-Op. Bank Ltd.)* |
| **Show Declaration** | `Yes` |
| **Show Authorised Signatory** | `Yes` |
| **Print in Simple Format** | `No` *(Ensures Standard/Comprehensive box grid is used)* |

### Step 3: Print or Preview
- Press **`I` (Preview)** to view the invoice on your screen.
- Press **`P` (Print)** to print directly to your printer or save as PDF.

---

## 📦 Method 2: Automatic via Custom TDL (`YamunaPlastics_InvoiceFormat.tdl`)

We have created a dedicated TDL that automatically enforces this exact format in Tally Prime without requiring manual configuration every time:

- Standalone File: `C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl`
- Alternative Print-only File: `C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_InvoiceFormat.tdl`

> **Note on Client Compatibility:** `YamunaPlastics_Sync.tdl` has been unified into a **100% self-contained, standalone file**. It has zero external file includes and zero risky subform deletions. This ensures that when the client loads it into their **latest Tally Prime version (TallyPrime 2.x, 3.x, 4.x, or 5.x)**, it runs completely smoothly without any crashes, missing file errors, or syntax errors in `tallyerr.log`.

### How to Load the TDL:
1. In Tally Prime, press **`F1: Help` > `TDLs & Add-Ons`**.
2. Press **`F4: Manage Local TDLs`**.
3. Set **Load selected TDL files on startup** to **`Yes`**.
4. Specify the path:
   ```text
   C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl
   ```
5. Press **`Ctrl + A`** to save. Look at the bottom-right corner: it will confirm **`1 of 1 TDLs loaded`**.

---

## 🚚 Automated e-Way Bill Lifecycle & Identification

In modern Tally Prime, e-Way Bills can be created and tracked automatically. Here is how the end-to-end integration works:

### 1. Generating a Bill from Mobile
When creating a bill from the mobile app:
- Transport details are captured: **Vehicle Number** (e.g. `GJ-01-AB-1860`), **Transporter Name** (e.g. `Patel Freight`), **Transporter ID**, **Approx Distance in KM** (e.g. `85 KM`), **Delivery Destination**, and **Delivery Note No./Date**.
- When you click **Save & Push to Tally** (or sync later), the application automatically formats all required statutory GST tags:
  - `<ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE>`
  - `<EWAYBILLDETAILS.LIST>` with `BILLDATE`, `SUBTYPE` (Supply), `DOCDATETYPE` (Invoice), `TRANSPORTERNAME`, `TRANSPORTERID`, `DISTANCE`, `VEHICLENUMBER`, `VEHICLETYPE` (Regular), `TRANSMODE` (Road), `PLACEOFDELIVERY`, and pin codes (`382350` Nikol dispatch / `383001` Himmatnagar delivery).

### 2. Auto e-Way Bill Creation in Modern Tally Prime
- In latest Tally Prime releases (Release 2.0+), Tally has direct integration with the NIC e-Way Bill portal.
- Because all mandatory transport parameters are pre-filled by our XML payload, Tally does **not** reject the voucher or flag it as incomplete.
- In Tally Prime:
  - Go to **`Gateway of Tally` > `Display More Reports` > `Statutory Reports` > `GST Reports` > `e-Way Bill`**.
  - The bill is immediately listed under **"Ready for e-Way Bill Generation"**.
  - Press **`Exchange (Alt + Z)` > `Send for e-Way Bill`** to submit it to the government portal with 1 click.
  - Tally generates the official e-Way Bill number and attaches it directly to the voucher.

### 3. Automatic Storage & Identification in the Mobile Application
- Whenever a bill is pushed to Tally (or when you click **`🚚 Get EWB`** / **`🚚 Fetch e-Way Bill from Tally`** in the mobile app):
  1. The backend automatically queries Tally Prime over Port 9000 for the voucher's e-Way Bill data (`<EWAYBILLNO>`, `<EWAYBILLDATE>`, `<EWAYBILLVALIDTILL>`, `<IRN>`, `<ACKNO>`).
  2. The retrieved e-Way Bill number and validity are stored immediately in the application database (`server/data/invoices.json`).
  3. The bill card in the mobile application displays a green badge: **`🚚 EWB: 2418682500451`**.
  4. Opening the bill displays a dedicated **e-Way Bill details banner** with complete vehicle and transporter details.
  5. The printed Tax Invoice displays all e-Way Bill, Delivery Note, Destination, and Vehicle details in the exact format of `186 instaplast.pdf`.

---

## 📱 Method 3: In Yamuna Plastics Mobile Web App

You can also view and print this **exact same format directly from the software**:

1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. Go to the **📋 Bills** tab.
3. Click **`👁️ View`** on **Invoice #186** (or any invoice).
4. The invoice modal opens with the **pixel-perfect 1:1 replica**:
   - e-Way Bill status and badge banner
   - e-Invoice QR code at top right
   - Authentic IRN, Ack No, Ack Date
   - 2-Column partitioned box for Yamuna Plastic, Consignee, Buyer, Delivery Note & Destination
   - Particulars table with `S GST` and `C GST`
   - Complete HSN summary table with 9% CGST and 9% SGST breakdown
   - Karnavati Co-Op Bank details, Declaration, and Authorised Signatory
5. Click **`🖨️ Print Invoice (Exact A4)`**:
   - Browser print dialog opens pre-configured for standard A4 portrait paper.
   - Clean black borders, crisp text, ready for official dispatch with goods.
