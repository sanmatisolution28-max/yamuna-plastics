# 🚀 Yamuna Plastics — Live Production Setup & Tally TDL Integration Guide
## Standard Operating Procedure: Live Cloud Web Portal & Client PC Tally Prime

This manual provides direct, operational guidelines for running the **Yamuna Plastics Mobile Billing & Tally Prime Integration** once the application code is deployed and live in the cloud.

---

## 📑 Table of Contents
1. [Live Cloud Web Portal (Mobile Access Anywhere)](#1-live-cloud-web-portal-mobile-access-anywhere)
2. [Client PC Setup: Single TDL Installation (2 Minutes)](#2-client-pc-setup-single-tdl-installation-2-minutes)
3. [One-Time Cloud URL Configuration in Tally](#3-one-time-cloud-url-configuration-in-tally)
4. [Daily Accountant Workflow (1-Click Sync)](#4-daily-accountant-workflow-1-click-sync)
5. [Important: Does Tally Prime Need to Be Open?](#5-important-does-tally-prime-need-to-be-open)
6. [Automatic e-Way Bill Integration (Zero-Click in Tally)](#6-automatic-e-way-bill-integration-zero-click-in-tally)
7. [Tally Print Configuration (Matching 186 instaplast.pdf)](#7-tally-print-configuration-matching-186-instaplastpdf)
8. [Live End-to-End Testing & Verification Protocol](#8-live-end-to-end-testing--verification-protocol)
9. [Troubleshooting & Support Matrix](#9-troubleshooting--support-matrix)

---

## 1. Live Cloud Web Portal (Mobile Access Anywhere)

Once your application is live on your cloud domain (e.g. `https://billing.yamunaplastics.com` or live cloud server):

### Live Endpoints:
* **Mobile Web Application**: `https://<YOUR-LIVE-DOMAIN>/`
* **Real-Time Tally XML API**: `https://<YOUR-LIVE-DOMAIN>/api/tally/export-xml`
* **Server Health Status**: `https://<YOUR-LIVE-DOMAIN>/api/tally/status`

### User Operations on Mobile / Tablet:
1. Factory workers, dispatch supervisors, drivers, and sales personnel open the live URL in any mobile browser (Chrome, Safari, Firefox).
2. Users can create invoices, select buyers (e.g. `INSTAPLAST`), enter items (`T. C. INNER`), quantity, rate, and transport details.
3. Invoices are instantly saved to the secure cloud database and queued for Tally synchronization.
4. Staff can print delivery challans and PDF invoices directly from their phones.

---

## 2. Client PC Setup: Single TDL Installation (2 Minutes)

On the client’s accounting PC (where Tally Prime runs), **NO code, NO Node.js, and NO developer tools are installed**. You only need to load the single TDL file.

### Step 2.1: Copy the TDL File
Copy the file `YamunaPlastics_Sync.tdl` to the client's Tally folder:
```text
C:\TallyPrime\YamunaPlastics_Sync.tdl
```

### Step 2.2: Load TDL in Tally Prime
1. Open **Tally Prime** with the **Yamuna Plastics Pvt. Ltd.** company open.
2. Press **`F1: Help`** (top-right menu) ➔ select **`TDLs & Add-Ons`** (or press `Ctrl + Alt + T`).
3. Press **`F4: Manage Local TDLs`**.
4. Set **`Load selected TDL files on startup`** to **`Yes`**.
5. In the file list under **File Path**, type or browse to:
   ```text
   C:\TallyPrime\YamunaPlastics_Sync.tdl
   ```
6. Press **`Enter`** and press **`Ctrl + A`** to save.
7. Verify that the bottom-right corner shows: **`1 of 1 TDLs loaded (0 errors)`**.

---

## 3. One-Time Cloud URL Configuration in Tally

1. On the **Gateway of Tally**, open the menu:  
   **`Yamuna Plastics Mobile Sync`** ➔ **`Configure Live Cloud Portal URL`**.
2. Enter the live cloud settings:
   * **Live Cloud Portal URL**: Enter your live URL (e.g. `https://billing.yamunaplastics.com`).
   * **Local XML Backup Path**: `C:\TallyPrime\YamunaPlastics_Import.xml`.
3. Press **`Enter`** and save with **`Ctrl + A`**.  
   *(Tally stores this setting permanently; you only configure this once)*.

---

## 4. Daily Accountant Workflow (1-Click Sync)

Once configured, the client accountant follows this daily procedure:

### Method 1: Direct 1-Click Sync (F6)
1. Open Tally Prime.
2. Go to **Gateway of Tally** ➔ **`Yamuna Plastics Mobile Sync`** ➔ **`Sync All Pending Bills from Live Portal`**  
   *(Or press the **`F6`** hotkey from the Sync Dashboard)*.
3. Tally connects over HTTPS to your live cloud server and fetches all pending mobile bills.
4. Tally displays:  
   `Sync Completed successfully! All pending bills have been imported into Sales Vouchers.`
5. Tally automatically opens the **Sales Day Book** showing all imported invoices with party ledgers, HSN codes, and GST breakdown.

### Method 2: Offline / Manual XML Fallback (F7)
If the client PC temporarily loses internet access:
1. Open the live cloud portal (`https://<YOUR-LIVE-DOMAIN>`) in any browser.
2. Go to **Invoices** ➔ click **`Export to Tally XML`**.
3. Save the file as `C:\TallyPrime\YamunaPlastics_Import.xml`.
4. In Tally Prime, press **`F7: Import File`** (or select `Import Local XML File`).
5. All vouchers are imported immediately into Tally.

---

## 5. Important: Does Tally Prime Need to Be Open?

Here is the exact operational rule regarding Tally's state:

### 1. Does billing stop if Tally is closed? ➔ NO!
* Factory staff, drivers, and sales team can **continue making bills 24/7 on the mobile app**, even when Tally Prime is closed or the PC is off.
* All bills are safely stored in the live cloud database with status **"Pending Tally Sync"**. **Zero data is ever lost.**

### 2. Can bills enter Tally Day Book while Tally is closed? ➔ NO
* Tally Prime's database engine only runs when the Tally application is open and the Yamuna Plastics company is loaded.
* Windows cannot write into Tally's proprietary files when Tally is closed.

### 3. How pending bills sync when Tally opens:
* Whenever the accountant arrives and opens Tally Prime (morning, evening, or once a day), they simply press **`F6`**.
* **ALL accumulated pending bills** (whether 5 bills or 100 bills) sync from the cloud into Tally Day Book in one quick batch!

### 4. Optional: Keeping Tally Always Ready
* The client can simply keep **Tally Prime minimized** on the taskbar during working hours.
* You can also add Tally Prime to the Windows **Startup folder** (`shell:startup`) so Tally opens automatically when the PC powers on.

---

## 6. Automatic e-Way Bill Integration (Zero-Click in Tally)

In latest releases of Tally Prime (3.0, 4.0, 5.0), manual voucher creation normally asks: *"Do you want to generate e-Way Bill? [Yes/No]"* and requires the accountant to click.

**With Yamuna Plastics integration, this is 100% AUTOMATED without any clicks in Tally:**

### How Zero-Click e-Way Bill Works:
1. **Automated in Cloud**: Whenever an invoice value is ₹50,000+ (or vehicle details are entered), our cloud backend automatically calculates and assigns the full statutory e-Way Bill package:
   * 12-digit e-Way Bill number (`<EWAYBILLNO>`)
   * e-Way Bill Date & Validity Date (`<EWAYBILLDATE>`, `<EWAYBILLVALIDTILL>`)
   * Vehicle Number (`<VEHICLENUMBER>`) & Transport Mode Road
   * Transporter Name & ID (`<TRANSPORTERNAME>`)
   * Distance in KM (`<DISTANCE>`) & Delivery Pincode (`<CONSIGNEEPINCODE>`)
   * Status Tag: `<EWBSTATUS>Generated</EWBSTATUS>`
2. **Auto-Recognized by Tally**: When Tally Prime imports the voucher via **`F6`**, it reads the `<EWAYBILLNO>` and `<EWBSTATUS>Generated</EWBSTATUS>` tags.
3. **No Popups or Prompts**: Because Tally sees the e-Way Bill number is already active, **Tally will NEVER ask "Do you want to generate e-Way Bill?"**
4. **Auto-Printed on Invoice**: When the accountant prints the invoice (`Ctrl + P`), the e-Way Bill number and details appear automatically at the top of the invoice matching `186 instaplast.pdf`.

> **One-Time Setting in Tally Prime (F11 Features):**  
> Go to **`F11: Features`** ➔ **`Enable Goods and Services Tax (GST)`** ➔ Under e-Way Bill, set **`Send e-Way Bill details with Sales voucher`** to **`No`**.  
> This ensures Tally does not display interactive prompts, since all e-Way Bill details are already provided by the cloud sync!

---

## 7. Tally Print Configuration (Matching 186 instaplast.pdf)

To configure Tally Prime to print official A4 tax invoices matching the client's format (`186 instaplast.pdf`):

1. Go to **`Gateway of Tally` > `Day Book`** ➔ Open any Sales Voucher.
2. Press **`Ctrl + P`** (Print) ➔ Press **`C` (Configure)**.
3. Apply the following settings:

| Setting Name | Configuration Value | Function in Invoice |
|---|---|---|
| **Printer** | `Microsoft Print to PDF` / A4 Laser Printer | Ensures standard A4 output (do NOT use thermal receipt printers). |
| **Print in Simple Format** | `No` | Enforces the official structured box-grid layout. |
| **Show Place of Supply** | `Yes` | Displays `Place of Supply : Gujarat (24)`. |
| **Show Bank Details** | `Yes` | Displays bank account box at bottom-right. |
| **Bank Name** | `The Karnavati Co-Op. Bank Ltd.` | A/c: `124002005002108`, IFSC: `GSCB0UTKCBL`. |
| **Show A/c Holder's Name** | `Yes` | Displays `YAMUNA PLASTIC`. |
| **Show Customer's Seal & Signature** | `Yes` | Displays the customer acknowledgment sign box. |
| **Show Address in continuous line** | `Yes` | Wraps buyer and consignee addresses cleanly across lines. |
| **Show GST Analysis of Items** | `Yes` | Generates the statutory HSN tax breakdown table. |
| **Show e-Way Bill No.** | `Yes` | Prints the 12-digit e-Way Bill reference. |

4. Press **`Esc`** ➔ Press **`I` (Preview)** ➔ Press **`Alt + Z`** to zoom in and verify.

---

## 8. Live End-to-End Testing & Verification Protocol

Follow this 6-step checklist to test the live system:

| Step | Action | Expected Result |
|---|---|---|
| **Step 1** | Open live URL on mobile phone (`https://<YOUR-LIVE-DOMAIN>`) | Responsive billing interface opens on mobile browser. |
| **Step 2** | Create a test bill (Buyer: `INSTAPLAST INDIA`, Item: `T. C. INNER`, Vehicle: `GJ-01-AB-1880`) | Invoice is saved in cloud with e-Way Bill status "Active". |
| **Step 3** | Open Tally Prime on client PC | Gateway of Tally shows `Yamuna Plastics Mobile Sync`. |
| **Step 4** | Press `F6: Sync API` in Tally Prime | Tally pulls voucher from cloud with e-Way Bill attached (zero clicks/popups). |
| **Step 5** | Check Sales Day Book in Tally | Voucher appears with party, items, HSN `39235010`, CGST 9%, and SGST 9%. |
| **Step 6** | Preview Invoice (`Ctrl + P` > `Preview`) | Full A4 invoice layout displays e-Way Bill No., bank details, and HSN tax table. |

---

## 9. Troubleshooting & Support Matrix

| Issue | Cause | Solution |
|---|---|---|
| **TDL file shows error in Tally** | Incorrect file path | Check `F1 > TDLs & Add-Ons > F4` and ensure path is `C:\TallyPrime\YamunaPlastics_Sync.tdl`. |
| **"Could not connect to API" on F6** | URL mistyped or no PC internet | Go to `Yamuna Plastics Mobile Sync > Configure Live Cloud Portal URL`, ensure URL starts with `https://`. Test URL in Chrome. |
| **Bills made while Tally was closed not showing** | Pending sync not executed yet | In Tally Prime, press `F6` to pull all accumulated bills from the cloud. |
| **Tally asks "Do you want to generate e-Way Bill?"** | F11 interactive setting enabled | In Tally `F11 > GST`, set `Send e-Way Bill details with Sales voucher: No`. The XML already provides the active e-Way Bill details. |
| **Invoice text squeezed in print** | Thermal printer driver selected | In Print Configuration (`Ctrl + P > C`), set printer to `Microsoft Print to PDF` or A4 Laser Printer. |
| **Address overlapping lines** | Continuous line setting disabled | Set `Show Address in a continuous line: Yes` in Tally Print Configuration. |

---

**System Version:** Live Cloud Production Edition  
**Integration Interface:** TDL HTTPS Sync Engine (`YamunaPlastics_Sync.tdl`)  
**Supported Tally Releases:** TallyPrime 2.x, 3.x, 4.x, 5.0 & Tally.ERP 9
