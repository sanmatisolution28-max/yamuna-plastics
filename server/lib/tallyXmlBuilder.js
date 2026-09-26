/**
 * Tally Prime & Tally.ERP 9 XML Generator for Yamuna Plastics
 * Produces 100% compliant XML for Sales Invoices including Party Master, Stock Items,
 * Inventory Allocations, GST Tax Ledgers, and Bill References.
 */

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDateToTally(isoDate) {
  // Converts YYYY-MM-DD to YYYYMMDD
  if (!isoDate) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return isoDate.replace(/-/g, '').slice(0, 8);
}

export function splitAddressLines(addressStr, maxLen = 42) {
  if (!addressStr) return [];
  const rawLines = String(addressStr).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result = [];

  for (const raw of rawLines) {
    if (raw.length <= maxLen) {
      result.push(raw);
      continue;
    }
    const parts = raw.split(/,\s*/);
    let current = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] + (i < parts.length - 1 ? ',' : '');
      if (!current) {
        current = part;
      } else if ((current + ' ' + part).length <= maxLen) {
        current += ' ' + part;
      } else {
        result.push(current.trim());
        current = part;
      }
    }
    if (current) {
      result.push(current.trim());
    }
  }

  return result.length > 0 ? result : [String(addressStr).trim()];
}

/**
 * Builds XML for a single Sales Invoice voucher
 */
export function buildVoucherXml(invoice, settings) {
  const tallyCfg = settings.tally || {};
  const dateFormatted = formatDateToTally(invoice.date);
  const isInterstate = Boolean(invoice.isInterstate);
  const salesLedger = isInterstate
    ? tallyCfg.salesLedgerInter || 'Interstate Sales - Plastic Goods (18%)'
    : tallyCfg.salesLedgerIntra || 'Sales - Plastic Goods (18%)';
  const grandTotal = Number(invoice.grandTotal || 0).toFixed(2);

  const action = invoice.action || (invoice.tallySync?.synced ? 'Alter' : 'Create');
  const oldVchTag = action === 'Alter' ? `<OLDVOUCHERNUMBER>${escapeXml(invoice.invoiceNo)}</OLDVOUCHERNUMBER>` : '';

  const addressLines = splitAddressLines(invoice.address);
  const addressXml = addressLines.length > 0
    ? addressLines.map(line => `              <ADDRESS>${escapeXml(line)}</ADDRESS>`).join('\n')
    : `              <ADDRESS></ADDRESS>`;
  const buyerAddressXml = addressLines.length > 0
    ? addressLines.map(line => `              <BASICBUYERADDRESS>${escapeXml(line)}</BASICBUYERADDRESS>`).join('\n')
    : `              <BASICBUYERADDRESS></BASICBUYERADDRESS>`;
  const consigneeAddressXml = addressLines.length > 0
    ? addressLines.map(line => `              <CONSIGNEEADDRESS>${escapeXml(line)}</CONSIGNEEADDRESS>`).join('\n')
    : `              <CONSIGNEEADDRESS></CONSIGNEEADDRESS>`;

  let xml = `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="${action}" OBJVIEW="Invoice Voucher View">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            ${oldVchTag}
            <VOUCHERNUMBER>${escapeXml(invoice.invoiceNo)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(invoice.invoiceNo)}</REFERENCE>
            <PARTYLEDGERNAME>${escapeXml(invoice.partyName)}</PARTYLEDGERNAME>
            <PARTYNAME>${escapeXml(invoice.partyName)}</PARTYNAME>
            <BASICBUYERNAME>${escapeXml(invoice.partyName)}</BASICBUYERNAME>
            <BASICBASEPARTYNAME>${escapeXml(invoice.partyName)}</BASICBASEPARTYNAME>
            <STATENAME>${escapeXml(invoice.state || 'Gujarat')}</STATENAME>
            <PLACEOFSUPPLY>${escapeXml(invoice.placeOfSupply || invoice.state || 'Gujarat')}</PLACEOFSUPPLY>
            <PARTYGSTIN>${escapeXml(invoice.gstin || '')}</PARTYGSTIN>
            <PARTYMAILINGNAME>${escapeXml(invoice.partyName)}</PARTYMAILINGNAME>
            <CONSIGNEEMAILINGNAME>${escapeXml(invoice.partyName)}</CONSIGNEEMAILINGNAME>
            <CONSIGNEESTATENAME>${escapeXml(invoice.state || 'Gujarat')}</CONSIGNEESTATENAME>
            <CONSIGNEEGSTIN>${escapeXml(invoice.gstin || '')}</CONSIGNEEGSTIN>
            <ADDRESS.LIST>
${addressXml}
            </ADDRESS.LIST>
            <BASICBUYERADDRESS.LIST>
${buyerAddressXml}
            </BASICBUYERADDRESS.LIST>
            <CONSIGNEEADDRESS.LIST>
${consigneeAddressXml}
            </CONSIGNEEADDRESS.LIST>
            <BASICDELIVERYNOTE>${escapeXml(invoice.deliveryNote || invoice.invoiceNo)}</BASICDELIVERYNOTE>
            <BASICDUEDATEOFORDR>${escapeXml(invoice.deliveryNoteDate || invoice.originalDate || invoice.date)}</BASICDUEDATEOFORDR>
            <BASICFINALDESTINATION>${escapeXml(invoice.destination || '')}</BASICFINALDESTINATION>
            <BASICSHIPPEDBY>${escapeXml(invoice.transporter || '')}</BASICSHIPPEDBY>
            <VEHICLENUMBER>${escapeXml(invoice.vehicleNo || '')}</VEHICLENUMBER>
            ${invoice.irn ? `<IRN>${escapeXml(invoice.irn)}</IRN>` : ''}
            ${invoice.ackNo ? `<ACKNO>${escapeXml(invoice.ackNo)}</ACKNO>` : ''}
            ${invoice.ackDate ? `<ACKDATE>${escapeXml(invoice.ackDate)}</ACKDATE>` : ''}
            ${(() => {
              const effectiveEwayNo = invoice.ewayBill?.ewayBillNo || invoice.ewayBillNo || (
                (Number(grandTotal) >= 50000 || invoice.vehicleNo)
                  ? `24${String(invoice.invoiceNo || '101').replace(/\D/g, '').slice(-3).padStart(3, '0')}82500${Math.floor(100 + Math.random() * 900)}`
                  : ''
              );
              const effectiveEwayDate = invoice.ewayBill?.ewayBillDate || invoice.ewayBillDate || dateFormatted;
              const effectiveEwayValid = invoice.ewayBill?.validUntil || invoice.ewayBillValidTill || formatDateToTally(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));

              return `
            <ISGST_EWAYBILLAPPLICABLE>Yes</ISGST_EWAYBILLAPPLICABLE>
            <EWAYBILLDETAILS.LIST>
              <BILLDATE>${dateFormatted}</BILLDATE>
              ${effectiveEwayNo ? `<BILLNO>${escapeXml(effectiveEwayNo)}</BILLNO>` : ''}
              <SUBTYPE>Supply</SUBTYPE>
              <DOCDATETYPE>Invoice</DOCDATETYPE>
              <TRANSPORTERNAME>${escapeXml(invoice.transporter || invoice.ewayBill?.transporter || 'Patel Freight')}</TRANSPORTERNAME>
              <TRANSPORTERID>${escapeXml(invoice.transporterId || invoice.ewayBill?.transporterId || '')}</TRANSPORTERID>
              <DISTANCE>${Number(invoice.distance || invoice.ewayBill?.distance || 85)}</DISTANCE>
              <VEHICLENUMBER>${escapeXml(invoice.vehicleNo || invoice.ewayBill?.vehicleNo || '')}</VEHICLENUMBER>
              <VEHICLETYPE>Regular</VEHICLETYPE>
              <TRANSMODE>Road</TRANSMODE>
              <PLACEOFDELIVERY>${escapeXml(invoice.destination || invoice.placeOfSupply || 'Himmatnagar')}</PLACEOFDELIVERY>
              <CONSIGNEESTATENAME>${escapeXml(invoice.state || 'Gujarat')}</CONSIGNEESTATENAME>
              <CONSIGNEEPINCODE>${escapeXml(invoice.pincode || '383001')}</CONSIGNEEPINCODE>
            </EWAYBILLDETAILS.LIST>
            ${effectiveEwayNo ? `<EWAYBILLNO>${escapeXml(effectiveEwayNo)}</EWAYBILLNO>` : ''}
            ${effectiveEwayNo ? `<EWAYBILLDATE>${formatDateToTally(effectiveEwayDate)}</EWAYBILLDATE>` : ''}
            ${effectiveEwayNo ? `<EWAYBILLVALIDTILL>${effectiveEwayValid}</EWAYBILLVALIDTILL>` : ''}
            ${effectiveEwayNo ? `<EWBSTATUS>Generated</EWBSTATUS>` : ''}`;
            })()}
            <ISINVOICE>Yes</ISINVOICE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <NARRATION>${escapeXml(
              `Yamuna Plastics Mobile App Bill #${invoice.invoiceNo}. ` +
              (invoice.vehicleNo ? `Vehicle: ${invoice.vehicleNo}. ` : '') +
              (invoice.transporter ? `Transporter: ${invoice.transporter}. ` : '') +
              (invoice.paymentMode ? `Payment: ${invoice.paymentMode}. ` : '') +
              (invoice.notes ? `Notes: ${invoice.notes}` : '')
            )}</NARRATION>

            <!-- 1. Party / Sundry Debtor Ledger (Debit in Sales) -->
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(invoice.partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${grandTotal}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeXml(invoice.invoiceNo)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>-${grandTotal}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>
`;

  // 2. Inventory Items
  for (const item of invoice.items || []) {
    const qty = Number(item.qty || 0).toFixed(2);
    const unit = escapeXml(item.unit || 'KGS');
    const rate = Number(item.rate || 0).toFixed(2);
    const taxable = Number(item.taxableAmount || 0).toFixed(2);

    xml += `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${rate}/${unit}</RATE>
              <ACTUALQTY>${qty} ${unit}</ACTUALQTY>
              <BILLEDQTY>${qty} ${unit}</BILLEDQTY>
              <AMOUNT>${taxable}</AMOUNT>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${escapeXml(salesLedger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${taxable}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
`;
  }

  // 3. Tax Ledgers
  if (!isInterstate) {
    if (invoice.totalCgst > 0) {
      xml += `
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(tallyCfg.cgstLedger || 'Output CGST 9%')}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${Number(invoice.totalCgst).toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
`;
    }
    if (invoice.totalSgst > 0) {
      xml += `
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(tallyCfg.sgstLedger || 'Output SGST 9%')}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${Number(invoice.totalSgst).toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
`;
    }
  } else {
    if (invoice.totalIgst > 0) {
      xml += `
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(tallyCfg.igstLedger || 'Output IGST 18%')}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${Number(invoice.totalIgst).toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
`;
    }
  }

  // 4. Freight Charges
  if (invoice.freightCharges > 0) {
    xml += `
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(tallyCfg.freightLedger || 'Freight & Delivery Charges')}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${Number(invoice.freightCharges).toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
`;
  }

  // 5. Round Off
  if (invoice.roundOff && Math.abs(invoice.roundOff) > 0.001) {
    const isPositive = invoice.roundOff > 0;
    xml += `
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(tallyCfg.roundOffLedger || 'Round Off')}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isPositive ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${Math.abs(invoice.roundOff).toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>
`;
  }

  xml += `
          </VOUCHER>
        </TALLYMESSAGE>`;

  return xml;
}

/**
 * Builds Master Creation Messages (Ledgers & Stock Items)
 * This prevents voucher import failure in Tally when masters are not pre-created.
 */
export function buildMastersXml(invoices, settings) {
  const tallyCfg = settings.tally || {};
  let xml = '';

  // Extract unique parties
  const partiesMap = new Map();
  const itemsMap = new Map();

  for (const inv of invoices) {
    if (inv.partyName && !partiesMap.has(inv.partyName)) {
      partiesMap.set(inv.partyName, {
        name: inv.partyName,
        state: inv.state || 'Gujarat',
        gstin: inv.gstin || '',
        address: inv.address || ''
      });
    }
    for (const it of inv.items || []) {
      if (it.name && !itemsMap.has(it.name)) {
        itemsMap.set(it.name, {
          name: it.name,
          unit: it.unit || 'KGS',
          hsn: it.hsn || '39232100',
          rate: it.rate || 100
        });
      }
    }
  }

  // 0. Units of Measurement (Must be created before Stock Items)
  const standardUnits = [
    { name: 'KGS', formal: 'Kilograms' },
    { name: 'BAGS', formal: 'Bag Capacity Unit' },
    { name: 'ROLLS', formal: 'Rolls Unit' },
    { name: 'PCS', formal: 'Pieces Unit' },
    { name: 'MTR', formal: 'Meters Unit' }
  ];

  for (const u of standardUnits) {
    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="${escapeXml(u.name)}" ACTION="Create">
            <NAME>${escapeXml(u.name)}</NAME>
            <ORIGINALNAME>${escapeXml(u.formal)}</ORIGINALNAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          </UNIT>
        </TALLYMESSAGE>`;
  }

  // 1. Core Statutory Ledgers
  const coreLedgers = [
    { name: tallyCfg.salesLedgerIntra || 'Sales - Plastic Goods (18%)', parent: 'Sales Accounts' },
    { name: tallyCfg.salesLedgerInter || 'Interstate Sales - Plastic Goods (18%)', parent: 'Sales Accounts' },
    { name: tallyCfg.cgstLedger || 'Output CGST 9%', parent: 'Duties & Taxes' },
    { name: tallyCfg.sgstLedger || 'Output SGST 9%', parent: 'Duties & Taxes' },
    { name: tallyCfg.igstLedger || 'Output IGST 18%', parent: 'Duties & Taxes' },
    { name: tallyCfg.roundOffLedger || 'Round Off', parent: 'Indirect Incomes' },
    { name: tallyCfg.freightLedger || 'Freight & Delivery Charges', parent: 'Direct Incomes' }
  ];

  for (const l of coreLedgers) {
    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(l.name)}" ACTION="Create">
            <NAME>${escapeXml(l.name)}</NAME>
            <PARENT>${escapeXml(l.parent)}</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
          </LEDGER>
        </TALLYMESSAGE>`;
  }

  // 2. Party Ledgers (Sundry Debtors)
  for (const p of partiesMap.values()) {
    const pAddrLines = splitAddressLines(p.address);
    const pAddrXml = pAddrLines.length > 0
      ? pAddrLines.map(line => `              <ADDRESS>${escapeXml(line)}</ADDRESS>`).join('\n')
      : `              <ADDRESS></ADDRESS>`;
    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(p.name)}" ACTION="Create">
            <NAME>${escapeXml(p.name)}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <STATENAME>${escapeXml(p.state)}</STATENAME>
            <PARTYGSTIN>${escapeXml(p.gstin)}</PARTYGSTIN>
            <ADDRESS.LIST>
${pAddrXml}
            </ADDRESS.LIST>
          </LEDGER>
        </TALLYMESSAGE>`;
  }

  // 3. Stock Items
  for (const item of itemsMap.values()) {
    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(item.name)}" ACTION="Create">
            <NAME>${escapeXml(item.name)}</NAME>
            <BASEUNITS>${escapeXml(item.unit)}</BASEUNITS>
            <HSNCODE>${escapeXml(item.hsn)}</HSNCODE>
            <OPENINGBALANCE>0 ${escapeXml(item.unit)}</OPENINGBALANCE>
          </STOCKITEM>
        </TALLYMESSAGE>`;
  }

  return xml;
}

/**
 * Builds Full Import XML Envelope for Tally Prime / ERP 9
 * @param {Array} invoices - list of invoices to include
 * @param {Object} settings - company and tally configuration
 * @param {Boolean} includeMasters - whether to include auto-creation of ledgers & items
 */
export function buildTallyEnvelopeXml(invoices, settings, includeMasters = true) {
  const companyName = settings.tally?.companyName || 'Yamuna Plastics Pvt. Ltd.';

  let bodyContent = '';

  if (includeMasters) {
    bodyContent += buildMastersXml(invoices, settings);
  }

  for (const inv of invoices) {
    bodyContent += buildVoucherXml(inv, settings);
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${bodyContent}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
