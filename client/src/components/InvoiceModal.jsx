import React, { useState } from 'react';
import { formatINR } from '../utils/numberToWords';
import { api } from '../utils/api';

export default function InvoiceModal({ invoice, settings, onClose, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  if (!invoice) return null;

  const company = settings?.company || {
    name: 'YAMUNA PLASTIC',
    address: '26, PATEL ESTATE, OPP SAHAJANAND AVENUE, OPP MUKTIDHAM ESTATE, JIVANWADI, NIKOL GAM ROAD',
    city: 'AHMEDABAD - 382350',
    phone: '+91 9426082500',
    email: 'YAMUNAPLASTIC@YAHOO.COM',
    udyam: 'UDYAM-GJ-01-0051476 (Small)',
    gstin: '24AKNPP7596H1ZF',
    state: 'Gujarat',
    stateCode: '24',
    bankName: 'The Karnavati Co-Op.Bank Ltd.',
    bankBranch: 'Bapunagar',
    bankAccountNo: '124002005002108',
    bankIfsc: 'GSCB0UTKCBL'
  };

  const [currentInv, setCurrentInv] = useState(invoice);
  const [fetchingEwb, setFetchingEwb] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleFetchEwb = async () => {
    setFetchingEwb(true);
    setSyncMsg(null);
    try {
      const res = await api.fetchEwayBill(currentInv.id);
      if (res.success && res.ewayBill) {
        setSyncMsg({ type: 'success', text: `🚚 e-Way Bill #${res.ewayBill.ewayBillNo} retrieved & saved!` });
        setCurrentInv((prev) => ({ ...prev, ewayBill: res.ewayBill }));
        if (onSynced) onSynced(currentInv.id);
      } else {
        setSyncMsg({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
    } catch (err) {
      setSyncMsg({ type: 'error', text: `Failed to fetch e-Way bill: ${err.message}` });
    } finally {
      setFetchingEwb(false);
    }
  };

  const handleSyncToTally = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.syncInvoiceToTally(currentInv.id);
      if (res.success) {
        setSyncMsg({ type: 'success', text: `✅ ${res.message || 'Synced to Tally Prime successfully!'}` });
        if (onSynced) onSynced(currentInv.id);
        // Also attempt to pull e-Way bill
        try {
          const ewbRes = await api.fetchEwayBill(currentInv.id);
          if (ewbRes.success && ewbRes.ewayBill) {
            setCurrentInv((prev) => ({ ...prev, ewayBill: ewbRes.ewayBill }));
          }
        } catch {}
      } else {
        setSyncMsg({ type: 'error', text: `⚠️ ${res.error || res.message}` });
      }
    } catch (err) {
      setSyncMsg({ type: 'error', text: `Could not reach Tally: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const items = currentInv.items || [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const primaryUnit = items[0]?.unit || 'PCS';
  const primaryHsn = items[0]?.hsn || '39235010';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '840px' }} onClick={(e) => e.stopPropagation()}>
        {/* Top Control Bar (Screen only) */}
        <div className="modal-header no-print">
          <div className="modal-title">
            📄 Tax Invoice #{currentInv.invoiceNo} — Tally Exact Format
          </div>
          <button className="btn-sm-action" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Sync message banner (Screen only) */}
        {syncMsg && (
          <div
            className="no-print"
            style={{
              padding: '10px 16px',
              background: syncMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: syncMsg.type === 'success' ? '#15803d' : '#b91c1c',
              fontSize: '12px',
              fontWeight: 700,
              borderBottom: '1px solid #e2e8f0'
            }}
          >
            {syncMsg.text}
          </div>
        )}

        {/* Modal Body / Tally Authentic Printable Sheet */}
        <div className="modal-body" style={{ padding: '16px', background: '#f1f5f9' }}>
          <div
            className="tally-sheet-container"
            style={{
              background: '#ffffff',
              border: '1.5px solid #000000',
              color: '#000000',
              fontFamily: "'Arial', 'Helvetica', sans-serif",
              fontSize: '11px',
              lineHeight: '1.3',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            {/* Top Bar: IRN & Ack on left, Title in Center, QR Code on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.2fr 0.9fr',
                padding: '10px 12px 6px',
                borderBottom: '1.5px solid #000000',
                alignItems: 'flex-start'
              }}
            >
              {/* Left: IRN Details */}
              <div style={{ fontSize: '10px', wordBreak: 'break-all' }}>
                <div>
                  <strong>IRN : </strong>
                  <span style={{ fontFamily: 'monospace' }}>
                    {currentInv.irn || 'fe04202eafe15c883dc080ef77eafda0f0652276ee128-244035dc46d766e6389'}
                  </span>
                </div>
                <div style={{ marginTop: '2px' }}>
                  <strong>Ack No. : </strong>{currentInv.ackNo || '162625665132663'}
                </div>
                <div>
                  <strong>Ack Date : </strong>{currentInv.ackDate || currentInv.originalDate || currentInv.date}
                </div>
              </div>

              {/* Center: Tax Invoice & Recipient Copy */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.5px' }}>
                  Tax Invoice
                </div>
                <div style={{ fontSize: '11.5px', fontStyle: 'italic', fontWeight: 600, marginTop: '2px' }}>
                  (ORIGINAL FOR RECIPIENT)
                </div>
              </div>

              {/* Right: e-Invoice Title & 2D Barcode */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800 }}>e-Invoice</div>
                <img
                  src="/einvoice_qr.png"
                  alt="e-Invoice Barcode"
                  style={{
                    width: '78px',
                    height: '75px',
                    marginTop: '3px',
                    border: '1px solid #e2e8f0',
                    display: 'block'
                  }}
                  onError={(e) => {
                    // Fallback to QR placeholder if file not reachable
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* e-Way Bill Bar (if e-Way Bill exists or generated) */}
            {(currentInv.ewayBill?.ewayBillNo || currentInv.ewayBillNo) && (
              <div
                style={{
                  background: '#f0fdf4',
                  borderBottom: '1.5px solid #000000',
                  padding: '6px 12px',
                  fontSize: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 800, color: '#166534' }}>🚚 e-Way Bill No : </span>
                  <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '12px', color: '#15803d', letterSpacing: '0.5px' }}>
                    {currentInv.ewayBill?.ewayBillNo || currentInv.ewayBillNo}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '14px', color: '#334155' }}>
                  <span><strong>Date : </strong>{currentInv.ewayBill?.ewayBillDate || currentInv.originalDate || currentInv.date}</span>
                  <span><strong>Valid Till : </strong>{currentInv.ewayBill?.validUntil || '2 Days'}</span>
                  <span><strong>Approx Dist : </strong>{currentInv.ewayBill?.distance || 85} KM</span>
                  {currentInv.vehicleNo && <span><strong>Vehicle : </strong>{currentInv.vehicleNo}</span>}
                </div>
              </div>
            )}

            {/* 2-Column Split: Seller / Consignee / Buyer on Left vs Voucher Meta on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                borderBottom: '1.5px solid #000000'
              }}
            >
              {/* Left Column */}
              <div style={{ borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column' }}>
                {/* 1. Seller Particulars */}
                <div style={{ padding: '8px 10px', fontSize: '10.5px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' }}>
                    {company.name}
                  </div>
                  <div>26, PATEL ESTATE</div>
                  <div>OPP SAHAJANAND AVENUE</div>
                  <div>OPP MUKTIDHAM ESTATE, JIVANWADI</div>
                  <div>NIKOL GAM ROAD, AHMEDABAD -382350</div>
                  <div>MO NO +91 9426082500</div>
                  <div>EMAIL. YAMUNAPLASTIC@YAHOO.COM</div>
                  <div>UDYAM : {company.udyam || 'UDYAM-GJ-01-0051476 (Small)'}</div>
                  <div><strong>GSTIN/UIN:</strong> {company.gstin}</div>
                  <div>State Name : {company.state || 'Gujarat'}, Code : {company.stateCode || '24'}</div>
                  <div>Contact : +91-+919426082500</div>
                  <div>E-Mail : {company.email}</div>
                </div>

                {/* 2. Consignee (Ship to) */}
                <div style={{ borderTop: '1px solid #000000', padding: '6px 10px', fontSize: '10.5px' }}>
                  <div style={{ color: '#475569', fontSize: '10px' }}>Consignee (Ship to)</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>
                    {currentInv.partyName}
                  </div>
                  <div>{currentInv.address || 'HIMMATNAGAR, SABARKANTHA'}</div>
                  <div><strong>GSTIN/UIN :</strong> {currentInv.gstin || 'Unregistered'}</div>
                  <div>State Name : {currentInv.state || 'Gujarat'}, Code : {currentInv.stateCode || '24'}</div>
                </div>

                {/* 3. Buyer (Bill to) */}
                <div style={{ borderTop: '1px solid #000000', padding: '6px 10px', fontSize: '10.5px' }}>
                  <div style={{ color: '#475569', fontSize: '10px' }}>Buyer (Bill to)</div>
                  <div style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>
                    {currentInv.partyName}
                  </div>
                  <div>{currentInv.address || 'HIMMATNAGAR, SABARKANTHA'}</div>
                  <div><strong>GSTIN/UIN :</strong> {currentInv.gstin || 'Unregistered'}</div>
                  <div>State Name : {currentInv.state || 'Gujarat'}, Code : {currentInv.stateCode || '24'}</div>
                </div>
              </div>

              {/* Right Column: Key-Value Details Grid */}
              <div style={{ fontSize: '10.5px', display: 'flex', flexDirection: 'column' }}>
                {/* Row 1: Invoice No & Dated */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Invoice No.</div>
                    <div style={{ fontWeight: 900, fontSize: '12.5px' }}>{currentInv.invoiceNo}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Dated</div>
                    <div style={{ fontWeight: 800 }}>{currentInv.originalDate || currentInv.date}</div>
                  </div>
                </div>

                {/* Row 2: Delivery Note & Terms */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Delivery Note</div>
                    <div style={{ fontWeight: 800 }}>{currentInv.deliveryNote || currentInv.invoiceNo}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Mode/Terms of Payment</div>
                    <div>{currentInv.paymentMode || ''}</div>
                  </div>
                </div>

                {/* Row 3: Reference No. & Other References */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Reference No. & Date.</div>
                    <div>{currentInv.referenceNo || ''}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Other References</div>
                    <div>{currentInv.otherReferences || ''}</div>
                  </div>
                </div>

                {/* Row 4: Buyer's Order No. & Dated */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Buyer's Order No.</div>
                    <div>{currentInv.orderNo || ''}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Dated</div>
                    <div>{currentInv.orderDate || ''}</div>
                  </div>
                </div>

                {/* Row 5: Dispatch Doc No & Delivery Note Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Dispatch Doc No.</div>
                    <div>{currentInv.dispatchDocNo || ''}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Delivery Note Date</div>
                    <div style={{ fontWeight: 800 }}>{currentInv.deliveryNoteDate || currentInv.originalDate || currentInv.date}</div>
                  </div>
                </div>

                {/* Row 6: Dispatched through & Destination */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000000' }}>
                  <div style={{ padding: '6px 8px', borderRight: '1px solid #000000' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Dispatched through</div>
                    <div>{currentInv.transporter || currentInv.vehicleNo || ''}</div>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Destination</div>
                    <div style={{ fontWeight: 800 }}>{currentInv.destination || 'Himmatnagar'}</div>
                  </div>
                </div>

                {/* Row 7: Terms of Delivery */}
                <div style={{ padding: '6px 8px', flex: 1 }}>
                  <div style={{ color: '#475569', fontSize: '10px' }}>Terms of Delivery</div>
                  <div>{currentInv.termsOfDelivery || currentInv.notes || ''}</div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10.5px',
                borderBottom: '1.5px solid #000000'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #000000' }}>
                  <th style={{ width: '35px', padding: '6px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                    Sl<br/>No.
                  </th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'left' }}>
                    Description of Goods
                  </th>
                  <th style={{ width: '85px', padding: '6px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                    HSN/SAC
                  </th>
                  <th style={{ width: '105px', padding: '6px 6px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                    Quantity
                  </th>
                  <th style={{ width: '60px', padding: '6px 6px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                    Rate
                  </th>
                  <th style={{ width: '45px', padding: '6px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                    per
                  </th>
                  <th style={{ width: '95px', padding: '6px 8px', textAlign: 'right' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ verticalAlign: 'top' }}>
                    <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '6px 4px' }}>
                      {idx + 1}
                    </td>
                    <td style={{ borderRight: '1px solid #000000', padding: '6px 8px', fontWeight: 800 }}>
                      {it.name}
                    </td>
                    <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '6px 4px' }}>
                      {it.hsn || '39235010'}
                    </td>
                    <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '6px 6px', fontWeight: 800 }}>
                      {Number(it.qty).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {it.unit || 'PCS'}
                    </td>
                    <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '6px 6px' }}>
                      {Number(it.rate).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '6px 4px' }}>
                      {it.unit || 'PCS'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800 }}>
                      {Number(it.taxableAmount || (it.qty * it.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* S GST & C GST breakdown lines matching Tally */}
                {!currentInv.isInterstate ? (
                  <>
                    <tr>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000', textAlign: 'right', fontStyle: 'italic', fontWeight: 800, padding: '3px 8px' }}>
                        S GST
                      </td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 700 }}>
                        {Number(currentInv.totalSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000', textAlign: 'right', fontStyle: 'italic', fontWeight: 800, padding: '3px 8px' }}>
                        C GST
                      </td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 700 }}>
                        {Number(currentInv.totalCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000', textAlign: 'right', fontStyle: 'italic', fontWeight: 800, padding: '3px 8px' }}>
                      I GST
                    </td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 700 }}>
                      {Number(currentInv.totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {/* Vertical spacer */}
                <tr style={{ height: '35px' }}>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td></td>
                </tr>

                {/* Total Row */}
                <tr style={{ borderTop: '1px solid #000000', fontWeight: 900 }}>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000', padding: '5px 8px', textAlign: 'right' }}>
                    Total
                  </td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '5px 6px' }}>
                    {totalQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {primaryUnit}
                  </td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ textAlign: 'right', padding: '5px 8px', fontSize: '12px' }}>
                    {Number(currentInv.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount Chargeable (in words) & E. & O.E */}
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #000000', fontSize: '10.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Amount Chargeable (in words)</span>
                <span style={{ fontStyle: 'italic', fontWeight: 700 }}>E. & O.E</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: '11.5px', marginTop: '2px' }}>
                INR {currentInv.amountInWords || 'Seven Thousand Seven Hundred Eighty Eight Only'}
              </div>
            </div>

            {/* HSN/SAC Tax Summary Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                borderBottom: '1px solid #000000'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #000000' }}>
                  <th rowSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                    HSN/SAC
                  </th>
                  <th rowSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                    Taxable<br/>Value
                  </th>
                  {!currentInv.isInterstate ? (
                    <>
                      <th colSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                        CGST
                      </th>
                      <th colSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                        SGST/UTGST
                      </th>
                    </>
                  ) : (
                    <th colSpan={2} style={{ padding: '4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                      IGST
                    </th>
                  )}
                  <th rowSpan={2} style={{ padding: '4px', textAlign: 'right' }}>
                    Total<br/>Tax Amount
                  </th>
                </tr>
                <tr style={{ borderBottom: '1px solid #000000' }}>
                  <th style={{ padding: '2px', borderRight: '1px solid #000000', textAlign: 'center' }}>Rate</th>
                  <th style={{ padding: '2px', borderRight: '1px solid #000000', textAlign: 'right' }}>Amount</th>
                  {!currentInv.isInterstate && (
                    <>
                      <th style={{ padding: '2px', borderRight: '1px solid #000000', textAlign: 'center' }}>Rate</th>
                      <th style={{ padding: '2px', borderRight: '1px solid #000000', textAlign: 'right' }}>Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px' }}>
                    {primaryHsn}
                  </td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                    {Number(currentInv.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  {!currentInv.isInterstate ? (
                    <>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px' }}>9%</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px' }}>9%</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px' }}>18%</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  )}
                  <td style={{ textAlign: 'right', padding: '4px' }}>
                    {Number(currentInv.totalGst || (currentInv.totalCgst + currentInv.totalSgst + currentInv.totalIgst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* HSN Summary Total Row */}
                <tr style={{ borderTop: '1px solid #000000', fontWeight: 800 }}>
                  <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px' }}>Total</td>
                  <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                    {Number(currentInv.subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  {!currentInv.isInterstate ? (
                    <>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px' }}>
                        {Number(currentInv.totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  )}
                  <td style={{ textAlign: 'right', padding: '4px' }}>
                    {Number(currentInv.totalGst || (currentInv.totalCgst + currentInv.totalSgst + currentInv.totalIgst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Tax Amount in words */}
            <div style={{ padding: '4px 10px', borderBottom: '1px solid #000000', fontSize: '10.5px' }}>
              <strong>Tax Amount (in words) : </strong> 
              INR {currentInv.taxAmountInWords || 'One Thousand One Hundred Eighty Eight Only'}
            </div>

            {/* Bottom Split: Declaration on Left vs Bank Details & Signatory on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.3fr',
                fontSize: '10.5px'
              }}
            >
              {/* Left: Declaration */}
              <div style={{ padding: '8px 10px', borderRight: '1px solid #000000' }}>
                <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: '4px' }}>
                  Declaration
                </div>
                <div style={{ lineHeight: '1.35' }}>
                  We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                </div>
              </div>

              {/* Right: Bank Details & Authorised Signatory */}
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: '4px' }}>
                    Company's Bank Details
                  </div>
                  <div><strong>A/c Holder's Name : </strong>YAMUNA PLASTIC</div>
                  <div><strong>Bank Name : </strong>The Karnavati Co-Op.Bank Ltd.</div>
                  <div><strong>A/c No. : </strong>124002005002108</div>
                  <div><strong>Branch & IFS Code: </strong>Bapunagar & GSCB0UTKCBL</div>
                </div>

                <div style={{ textAlign: 'right', marginTop: '16px' }}>
                  <div style={{ fontWeight: 800 }}>for YAMUNA PLASTIC</div>
                  <div style={{ height: '32px' }}></div>
                  <div style={{ fontWeight: 800 }}>Authorised Signatory</div>
                </div>
              </div>
            </div>

            {/* Bottom Footer */}
            <div
              style={{
                textAlign: 'center',
                padding: '6px',
                borderTop: '1px solid #000000',
                fontSize: '10px',
                fontStyle: 'italic'
              }}
            >
              This is a Computer Generated Invoice
            </div>
          </div>
        </div>

        {/* Modal Footer (Screen Actions) */}
        <div className="modal-footer no-print">
          <button className="btn-sm-action" onClick={handlePrint}>
            🖨️ Print Invoice (Exact A4)
          </button>

          <button
            className="btn-sm-action"
            disabled={fetchingEwb}
            onClick={handleFetchEwb}
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 800 }}
          >
            {fetchingEwb ? 'Fetching from Tally...' : '🚚 Fetch e-Way Bill from Tally'}
          </button>

          <a
            href={`/api/tally/invoice-xml/${currentInv.id}`}
            download={`Tally_${currentInv.invoiceNo.replace(/\//g, '_')}.xml`}
            className="btn-sm-action"
            style={{ textDecoration: 'none' }}
          >
            📥 Download Tally XML
          </a>

          <button
            className="btn-sm-action btn-sm-sync"
            disabled={syncing}
            onClick={handleSyncToTally}
          >
            {syncing ? 'Pushing to Tally...' : '🔌 Push to Tally Prime'}
          </button>
        </div>
      </div>
    </div>
  );
}
