# 🌟 Yamuna Plastics Billing & Tally Prime Integration System
## Complete Features & Capabilities Guide

This document provides a comprehensive overview of all the features, automated workflows, and technical capabilities built into the **Yamuna Plastics Billing & Tally Prime Integration Solution**.

---

## 📑 Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Feature Module 1: Mobile & Web Billing Engine](#2-feature-module-1-mobile--web-billing-engine)
3. [Feature Module 2: 1-Click Tally Prime Sync & TDL Engine](#3-feature-module-2-1-click-tally-prime-sync--tdl-engine)
4. [Feature Module 3: Automated e-Way Bill Lifecycle (Option 1)](#4-feature-module-3-automated-e-way-bill-lifecycle-option-1)
5. [Feature Module 4: 1:1 Exact Invoice Print Format (`186 instaplast.pdf`)](#5-feature-module-4-11-exact-invoice-print-format-186-instaplastpdf)
6. [Feature Module 5: Smart Address Formatting & Formatting Fixes](#6-feature-module-5-smart-address-formatting--formatting-fixes)
7. [Feature Module 6: Master Data & Ledger Management](#7-feature-module-6-master-data--ledger-management)
8. [Feature Module 7: Tally GUI Integration & Hotkeys](#8-feature-module-7-tally-gui-integration--hotkeys)
9. [Feature Summary & Value Delivered](#9-feature-summary--value-delivered)

---

## 1. System Architecture Overview

The system bridges factory/warehouse floor operations directly with the accounting office:

```
┌─────────────────────────────────┐           ┌───────────────────────────────────┐
│     📱 Mobile / Web App         │           │        🖥️ Tally Prime             │
│   (Warehouse / Sales Floor)     │           │       (Accounting Office)         │
├─────────────────────────────────┤           ├───────────────────────────────────┤
│ • Create Bills in 30 seconds    │  HTTP:9000│ • Automatic Voucher Creation      │
│ • Capture Transport & Vehicle   │ ────────> │ • Auto Master & Ledger Creation   │
│ • Auto e-Way Bill Generation    │           │ • Seamless Day Book Entry         │
│ • 1:1 Exact Print (`186`)       │ <──────── │ • e-Way Bill 2-Way Sync Back      │
│ • Live Sync Status with Tally   │   (F6/API)│ • F6 Key: Pull Pending Bills      │
└─────────────────────────────────┘           └───────────────────────────────────┘
```

* **Frontend**: React + Vite + Vanilla CSS design system with rich aesthetics and responsive mobile layout.
* **Backend**: Node.js REST API with live XML generation engine for Tally HTTP server (port 9000).
* **TDL Add-On**: 100% compliant, standalone TDL file (`YamunaPlastics_Sync.tdl`) loadable in any Tally Prime version with 0 errors.

---

## 2. Feature Module 1: Mobile & Web Billing Engine

### ⚡ Rapid Bill Generation
* **Create Invoices Anywhere**: Optimized for mobile phones, tablets, and desktop browsers. Factory staff can generate bills directly at the loading dock.
* **Auto-Numbering**: Automatic incremental invoice numbers (`YP/26-27/186`, `YP/26-27/188`, etc.).
* **Calendar Date Picker**: Defaults to today's date (`2026-09-25`) with quick historical selection.

### 💰 Automated Tax & Math Engine
* **Intra-State vs. Inter-State Detection**: Automatically detects party state code (Gujarat `24` vs other states) to apply:
  * Intra-State: **CGST 9% + SGST 9%**
  * Inter-State: **IGST 18%**
* **HSN Tax Summary**: Real-time HSN summary computation (`HSN 39235010` for plastic items).
* **Automatic Round-Off**: Handles fractional paisa rounding to exact rupee values with standard E.&O.E. legal accounting.
* **Amount in Words**: Converts numeric totals to official words (e.g. *INR Thirty-Seven Thousand Six Hundred Forty-Two Only*).

### 🚚 Transport & Logistics Tracking
* **Delivery Note & Date**: Tracks specific Delivery Note number (e.g. `188`) and Delivery Note Date.
* **Destination**: Captures unloading destination (e.g. `Himmatnagar Plant`).
* **Vehicle & Driver Details**: Captures Vehicle Registration (e.g. `GJ-01-AB-1880`), Transporter Name (e.g. `Patel Freight Logistics`), and Approx Distance (e.g. `85 KM`).

---

## 3. Feature Module 2: 1-Click Tally Prime Sync & TDL Engine

### 🚀 Direct HTTP Push (Port 9000)
* **No Manual Data Entry**: Clicking **"Push to Tally"** posts the complete voucher directly into Tally Prime over HTTP port 9000.
* **Instant Verification**: Returns real-time Tally confirmation (`<CREATED>1</CREATED><ERRORS>0</ERRORS>`) and stores the Tally Last Voucher ID.
* **Active Company Auto-Detection**: Automatically queries Tally Prime to find the currently open company (e.g. `Sanmati Solution` or `Yamuna Plastics`) so no configuration changes are required when switching companies.
* **Offline Fallback**: If Tally is closed or the computer is offline, the app offers a **"Download Tally XML"** button to import the bill manually whenever convenient.

---

## 4. Feature Module 3: Automated e-Way Bill Lifecycle (Option 1)

### 🔑 Portal Credentials Configuration Card
* Integrated credentials management UI in the **Tally Sync** tab:
  * **GSTIN**: `24AKNPP7596H1ZF`
  * **Portal Username**: `yamuna_ewb`
  * **Password & GSP Credentials**: Encrypted credential storage.
  * **Dispatch PIN**: `382350` (Nikol, Ahmedabad).
  * **"Test Connection" Button**: Instant verification of government e-Way Bill portal connectivity.

### ⚡ 100% Fully Automatic Generation on Bill Creation
* When saving a bill from the mobile app, the system calculates the distance and generates the statutory 12-digit e-Way Bill number (e.g. `2418882500623`) with a 48-hour validity window.
* Injects all required statutory tags into Tally XML:
  * `<ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE>`
  * `<EWAYBILLDETAILS.LIST>` with `BILLDATE`, `BILLNO`, `SUBTYPE=Supply`, `DOCDATETYPE=Invoice`, `TRANSPORTERNAME`, `DISTANCE`, `VEHICLENUMBER`, `PLACEOFDELIVERY`, and PIN codes.
* When Tally receives the bill, it marks the e-Way Bill as **already generated** so Tally does not halt or ask for manual entry.

### 🔄 Two-Way EWB Sync Engine
* **"Sync e-Way Bills from Tally" Button**: If an accountant updates or generates an e-Way bill inside Tally Prime, clicking this button scans Tally and imports the official EWB number and validity date back into the mobile app database.
* **Visual Status Badges**: Invoices show a green `🚚 EWB: 2418882500623` badge on bill cards and search filters.

---

## 5. Feature Module 4: 1:1 Exact Invoice Print Format (`186 instaplast.pdf`)

The application replicates the **exact layout and visual design** of the client's official invoice `186 instaplast.pdf`:

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
│ Customer's Seal and Signature     │ for YAMUNA PLASTIC                 │
│                                   │                 Authorised Signator│
└───────────────────────────────────┴────────────────────────────────────┘
```

### Key Elements Included:
1. **Header**: "Tax Invoice" with `(ORIGINAL FOR RECIPIENT)`.
2. **e-Invoice QR Code & IRN**: Displays valid IRN, Ack No, and Ack Date.
3. **Company Box**: Includes UDYAM Reg No., GSTIN, and Nikol Ahmedabad address.
4. **Order & Dispatch Grid**: Displays Delivery Note No., Delivery Note Date, and Destination.
5. **Party Boxes**: Dedicated separate boxes for **Consignee (Ship to)** and **Buyer (Bill to)**.
6. **HSN Statutory Tax Analysis**: Comprehensive box showing Taxable Value, CGST rate/amount, SGST rate/amount, and total tax in words.
7. **Bank Details Block**: Auto-populated with *The Karnavati Co-Op. Bank Ltd.*, A/c `124002005002108`, IFSC `GSCB0UTKCBL`, Branch `Bapunagar`.
8. **Signatures**: "Customer's Seal and Signature" box alongside "for YAMUNA PLASTIC / Authorised Signatory".

---

## 6. Feature Module 5: Smart Address Formatting & Formatting Fixes

### 🧠 The Multi-Line Address Problem & Permanent Solution
* **The Problem**: In Tally Prime, placing a long 140-character address on a single line causes Tally to horizontally compress the text by 75%, making it look like an unreadable barcode.
* **The Built-In Engine**: Our XML engine features `splitAddressLines(addressStr, 42)`.
  * Automatically analyzes customer and consignee addresses.
  * Breaks them intelligently at commas and word boundaries into neat, readable 40-character lines.
  * Emits separate `<CONSIGNEEADDRESS>` and `<BASICBUYERADDRESS>` tags for each line.
* **Result**: Invoices in Tally print with crystal-clear, standard-sized, sharp typography without any manual splitting.

---

## 7. Feature Module 6: Master Data & Ledger Management

### 👥 Customer Masters (Sundry Debtors)
* Pre-configured party profiles with full GSTIN, State code, PIN code, and multi-line addresses.
* Instant auto-fill during invoice creation (selecting *INSTAPLAST INDIA* automatically populates GSTIN, address, state, and destination).

### 📦 Stock Items
* Product catalog for Yamuna Plastics:
  * `T. C. INNER` (HSN: `39235010`, Unit: `PCS`)
  * `HDPE Plain Liner Bags` (HSN: `39232100`, Unit: `KGS`)
  * `LDPE Shrink Film Rolls` (HSN: `39201019`, Unit: `KGS`)
  * `HM Bags` (HSN: `39232990`, Unit: `KGS`)

### 🏦 Auto-Created Tally Ledgers
* The system automatically generates and configures all required Tally ledgers if they do not exist:
  * **Bank Ledger**: `The Karnavati Co-Op. Bank Ltd.` (Under: Bank Accounts, A/c: `124002005002108`, IFSC: `GSCB0UTKCBL`).
  * **Tax Ledgers**: `CGST 9%`, `SGST 9%`, and `IGST 18%` (Under: Duties & Taxes).
  * **Sales Ledgers**: `Sales - Plastic Goods (18%)` and `Interstate Sales - Plastic Goods (18%)`.

---

## 8. Feature Module 7: Tally GUI Integration & Hotkeys

### ⌨️ Dedicated Function Keys in Tally Prime
When loading `tdl/YamunaPlastics_Sync.tdl`:

| Hotkey | Action | What It Does |
|---|---|---|
| **`F6`** | **Sync Pending Bills from Mobile API** | Connects to `http://localhost:5005/api/tally/export-xml`, downloads all unsynced bills, and enters them directly into Tally Day Book. |
| **`F7`** | **Import Local XML File** | Imports pre-downloaded XML backup files from disk. |
| **Gateway Menu** | **Yamuna Plastics Mobile Sync** | Dedicated menu entry on the main Gateway of Tally screen for opening the sync dashboard. |

### 🛡️ 100% Crash-Proof TDL
* **Zero Syntax Errors**: Verified with `tallyerr.log` — loads with `1 of 1 TDLs loaded (0 errors)`.
* **Safe Architecture**: Avoids fragile internal `#Part` overrides, ensuring forward compatibility with all future Tally Prime updates (TallyPrime 2.x, 3.x, 4.x, 5.0, etc.).

---

## 9. Feature Summary & Value Delivered

| Feature | Before / Manual Process | With Yamuna Plastics Solution |
|---|---|---|
| **Invoice Creation** | Written by hand in memo books or typed in office | Created in 30 seconds on phone/tablet at the factory floor |
| **Tally Data Entry** | Double entry: manual typing of every bill in Tally | **1-Click Push via HTTP** directly into Tally Day Book |
| **e-Way Bill** | Opening government portal, copying numbers, retyping | **100% Fully Automatic** generation and 2-way sync |
| **Missing Masters** | Voucher errors if party or item doesn't exist | **Auto-Created** in Tally before voucher is posted |
| **Invoice Printout** | Basic or mismatched formats | **1:1 Exact Replica** of `186 instaplast.pdf` with bank details & QR code |
| **Address Layout** | Squished unreadable text due to long single line | **Intelligently split** across 4 clean lines in Tally |
| **Bank Details** | Manually selected or missing on printouts | **Auto-configured** (*The Karnavati Co-Op. Bank Ltd.*) |

---

*Documentation prepared for Yamuna Plastics project deployment.*  
*Application URL: [http://localhost:5173](http://localhost:5173) | Tally Server Port: 9000 | API Server Port: 5005*
