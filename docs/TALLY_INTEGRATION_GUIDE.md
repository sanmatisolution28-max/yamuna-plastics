# Yamuna Plastics · Tally Prime & TDL Integration Guide

This guide provides complete, step-by-step instructions for integrating the **Yamuna Plastics Mobile Billing App** with **Tally Prime** and **Tally.ERP 9** using the provided TDL (Tally Definition Language) and automated XML REST APIs.

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│        Yamuna Plastics Mobile Application             │
│        (Phone / Tablet / Laptop Browser)               │
└───────────────────────────┬────────────────────────────┘
                            │ JSON POST (New Bill)
                            ▼
┌────────────────────────────────────────────────────────┐
│        Yamuna Plastics API Server (Port 5005)          │
│  - Tax & GST Calculation Engine                        │
│  - Tally XML Builder (<ENVELOPE> Schema)               │
│  - Port 9000 Direct HTTP Connector                     │
└─────────────────┬──────────────────────┬───────────────┘
                  │                      │
        Method 1: Direct Push   Method 2: TDL Pull (F6)
        (HTTP POST to Port 9000) (HTTP GET /api/tally/export-xml)
                  │                      │
                  ▼                      ▼
┌────────────────────────────────────────────────────────┐
│                   TALLY PRIME                          │
│  - Gateway Menu: "Yamuna Plastics Mobile Sync"         │
│  - Auto-created Party Ledgers & Plastic Stock Items    │
│  - Sales Vouchers automatically posted to Day Book     │
│  - Output CGST (9%), SGST (9%), IGST (18%)             │
└────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

1. **Tally Prime** (Release 1.0 or later) OR **Tally.ERP 9** (Release 6.0 or later) installed on your system.
2. An active company open in Tally Prime (e.g., **"Yamuna Plastics Pvt. Ltd."** or your active company name).
3. The Yamuna Plastics API Server running on port `5005`.

---

## ⚙️ Step 1: Enable HTTP Server in Tally Prime (Port 9000)

For direct 1-click sync between the mobile app and Tally, Tally's built-in HTTP server must be active on port `9000`.

1. Open **Tally Prime**.
2. Press **`F1: Help`** (or click **Help** in the top navigation bar).
3. Select **`Settings`** &gt; **`Connectivity`**.
4. In the Connectivity settings screen:
   - **TallyPrime acts as**: Change from *None* or *Client* to **`Both`** (or **`Server`**).
   - **Enable ODBC**: Set to **`Yes`**.
   - **Port**: Enter **`9000`** (Default).
5. Press **`Ctrl + A`** to save changes.
6. **Restart Tally Prime** when prompted so the server starts listening on Port 9000.

> **Verification:** Open your browser and navigate to `http://localhost:9000`. If active, you will see a Tally server response or test it directly in the mobile app under the **Tally Sync** tab.

---

## 🔌 Step 2: Load the TDL File in Tally Prime

The project includes a ready-to-use TDL file:
```
C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl
```

### Steps to Load:
1. In Tally Prime, press **`F1: Help`**.
2. Select **`TDLs & Add-Ons`** (shortcut: press `T`).
3. In the TDLs & Add-Ons window, press **`F4: Manage Local TDLs`**.
4. On the configuration screen:
   - **Load selected TDL files on startup?**: Set to **`Yes`**.
   - Under the **File Name** column, copy and paste the full path:
     ```text
     C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl
     ```
5. Press **`Enter`** and then press **`Ctrl + A`** to accept.
6. Look at the bottom right corner of Tally Prime:
   - **`1 of 1 TDLs loaded`** will be displayed in green with **0 errors**.

> **Compatibility with Client's Latest TallyPrime Version:**
> - `YamunaPlastics_Sync.tdl` is completely **self-contained into a single file** with zero relative `Include:` statements and zero subform deletions.
> - Fully compatible with **TallyPrime 1.x, 2.x, 3.x, 4.x, and 5.x**.
> - Safe for existing client data: it does not alter standard ledgers or modify other voucher types (receipt, payment, purchase). It only adds the Gateway menu and extends standard Sales printing.

---

## 🎯 Step 3: Check Gateway of Tally

Return to the **Gateway of Tally** (main screen).
You will now see a brand-new menu item:
```
Gateway of Tally
  ├── Masters
  ├── Transactions
  ├── Utilities
  ├── Reports
  ├── Yamuna Plastics Mobile Sync   <-- (HotKey: Y)
  └── Quit
```

Press **`Y`** to open the **Yamuna Plastics Menu**:
- **`S`** - Sync All Pending Bills from Mobile App (Direct HTTP Pull)
- **`I`** - Import Local XML File
- **`D`** - Yamuna Plastics Sync Dashboard
- **`C`** - Configure API Server Settings
- **`V`** - Open Sales Register

---

## 🚀 Step 4: Three Methods of Syncing Bills

### Method A: Direct 1-Click Push from Mobile App (Recommended)
1. Open the Yamuna Plastics Mobile App in your browser or phone.
2. Fill out the **Bill Generate Form**:
   - Choose or enter the customer (e.g., *Gujarat Agro Chemical Industries Ltd.*).
   - Add your plastic products (e.g., *HDPE Plain Liner Bags*, *PP Woven Sacks*).
   - Enter quantity and rate.
3. Click **`🔌 Generate & Sync to Tally`**.
4. The server automatically:
   - Saves the bill.
   - Formats the transaction into compliant Tally XML.
   - Pushes it directly to Tally Prime on Port 9000.
5. In Tally Prime, immediately open **Day Book** (`Gateway of Tally > Day Book` or press `K`). The Sales Voucher is already entered with all line items and GST ledgers!

---

### Method B: 1-Click Pull from Inside Tally Prime (TDL Action)
If your accountant is working inside Tally Prime and wants to pull all bills created by sales reps on their phones:
1. In Gateway of Tally, press **`Y`** (Yamuna Plastics Mobile Sync).
2. Press **`S`** (**Sync All Pending Bills from Mobile App**) OR press **`F6: Sync API`** on the dashboard.
3. Tally will connect to `http://localhost:5005/api/tally/export-xml`, download the pending bills, and automatically book the Sales Vouchers.
4. A popup will confirm: *"Sync Completed successfully! All pending bills from Yamuna Plastics Mobile App have been posted to your Sales Vouchers."*
5. Tally will automatically open the **Day Book** for review.

---

### Method C: Offline XML File Import
If Tally Prime is on an offline machine without network access:
1. In the mobile app, go to the **Tally Sync** tab and click **`📥 Download Full Tally XML File`** (or download individual invoice XML from the invoice view).
2. Save the file to your computer or USB drive (e.g., `C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Import.xml`).
3. In Tally Prime:
   - Press **`Alt + O`** (Import Menu).
   - Select **`Transactions`**.
   - In File Path / File Name, choose the downloaded XML file.
   - Press **`Enter`**. Tally will import all transactions immediately.

---

## 🧾 Step 5: How Tally Maps Ledgers & Items Automatically

The Yamuna Plastics XML engine automatically handles master creation so you never experience *"Ledger does not exist"* errors:

| Mobile App Field | Tally Ledger / Master Created | Parent Group in Tally |
|:---|:---|:---|
| Customer Name | Customer Ledger (e.g. *Surat Textile Traders*) | **Sundry Debtors** (Bill-wise Yes) |
| Intra-state Sales | `Sales - Plastic Goods (18%)` | **Sales Accounts** |
| Inter-state Sales | `Interstate Sales - Plastic Goods (18%)` | **Sales Accounts** |
| Central GST | `Output CGST 9%` | **Duties & Taxes** (GST) |
| State GST | `Output SGST 9%` | **Duties & Taxes** (GST) |
| Integrated GST | `Output IGST 18%` | **Duties & Taxes** (GST) |
| Freight / Transport | `Freight & Delivery Charges` | **Direct Incomes** |
| Round Off | `Round Off` | **Indirect Incomes** |
| Plastic Products | Product Name (e.g. *HDPE Plain Liner Bags*) | **Stock Items** (Units: KGS, BAGS, ROLLS) |

---

## 🔍 Step 6: Verifying Imported Vouchers in Tally

1. In Gateway of Tally, press **`D`** &gt; **`A`** &gt; **`S`** (**Display More Reports &gt; Account Books &gt; Sales Register**).
2. Open the current month (e.g. September).
3. Press **`Enter`** on any imported voucher (`YP/26-27/101`, `YP/26-27/102`, etc.).
4. Verify:
   - **Party Name**: Matched to the Sundry Debtor.
   - **Stock Item**: HDPE Bags / Granules / Sacks with correct quantities and units.
   - **Taxes**: CGST & SGST calculated for Gujarat parties; IGST for Rajasthan / Maharashtra parties.
   - **Narration**: Contains vehicle number, transporter name, and mobile app bill reference.

---

## 🚚 Step 7: Automated e-Way Bill Lifecycle & Sync Back to Mobile App

The latest Tally Prime has native e-Way Bill portal connectivity. The mobile app integrates with this lifecycle smoothly:

1. **Bill Creation in Mobile App**:
   - The user inputs the vehicle number, transporter name & ID, distance (KM), delivery note, and destination.
   - When generating the bill, the backend includes all required statutory e-Way Bill tags:
     - `<ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE>`
     - Full `<EWAYBILLDETAILS.LIST>` with `BILLDATE`, `SUBTYPE` (Supply), `DOCDATETYPE` (Invoice), `TRANSPORTERNAME`, `TRANSPORTERID`, `DISTANCE`, `VEHICLENUMBER`, `PLACEOFDELIVERY`, dispatch PIN (`382350`) and delivery PIN (`383001`).
2. **Auto Recognition in Tally Prime**:
   - When the voucher is posted to Tally Prime, Tally recognizes all statutory fields as valid.
   - In modern Tally Prime, the voucher goes directly to **"Ready for e-Way Bill Generation"** under `Gateway of Tally > GST Reports > e-Way Bill`.
   - With online e-Way Bill credentials configured in Tally Prime, clicking **"Exchange (Alt + Z) > Send for e-Way Bill"** automatically generates the e-Way Bill from the government portal and assigns the e-Way Bill Number and validity to the voucher.
3. **Automatic Identification & Storage in Mobile App**:
   - As soon as the bill is synced into Tally (or on clicking **`🚚 Get EWB`** / **`🚚 Fetch e-Way Bill`**):
     - The mobile application's backend queries Tally over Port 9000 for the voucher's e-Way Bill details (`<EWAYBILLNO>`, `<EWAYBILLDATE>`, `<EWAYBILLVALIDTILL>`, `<IRN>`, `<ACKNO>`).
     - The e-Way Bill is saved into `server/data/invoices.json`.
     - The invoice card immediately displays the green **`🚚 EWB: {ewbNo}`** badge.
     - The invoice view modal and printable invoice display the full e-Way Bill details banner with vehicle, transporter, and validity.

---

## 🛠️ Step 8: Troubleshooting & FAQ

### Q1: Error: "Could not connect to Tally Prime on localhost:9000"
- **Cause**: Tally Prime is either not running, or the HTTP server is not enabled.
- **Fix**: Open Tally Prime &gt; `F1: Help` &gt; `Settings` &gt; `Connectivity` &gt; Set `TallyPrime acts as` to **Both** &gt; Port **9000** &gt; Restart Tally Prime.

### Q2: TDL displays "TDL loaded with errors"
- **Cause**: Check if TDL syntax is modified or file path contains illegal escape characters.
- **Fix**: In `F4: Manage Local TDLs`, ensure the path is specified as `C:\Users\admin\Downloads\Projects\Yamuna Plastics\tdl\YamunaPlastics_Sync.tdl`. The file is pre-tested and 100% compliant with Tally Prime.

### Q3: Tally says "Company Not Open"
- **Cause**: Tally is open at the Select Company screen without any company loaded.
- **Fix**: Select and open your company (e.g. Yamuna Plastics Pvt. Ltd.) in Tally Prime before syncing.

### Q4: Can I change the GST tax rate for specific items?
- **Yes**: In the Mobile App bill generate form, each item has a dropdown for GST % (18%, 12%, 5%, 28%). The app and XML engine automatically calculate and route the tax to the proper Tally tax ledgers.

---

*© 2026 Yamuna Plastics Pvt. Ltd. All rights reserved.*
