import React, { useState } from 'react';
import { formatINR, numberToWords } from '../utils/numberToWords';
import { api } from '../utils/api';

export default function InvoiceModal({ invoice, settings, onClose, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [copyType, setCopyType] = useState('ORIGINAL FOR RECIPIENT');
  const [currentInv, setCurrentInv] = useState(invoice);
  const [fetchingEwb, setFetchingEwb] = useState(false);

  if (!currentInv) return null;

  const company = settings?.company || {
    name: 'YAMUNA PLASTIC',
    tagline: 'Manufacturer of Quality HDPE / LDPE Plastic Bags, Liners, Films & Rolls',
    address: '26, Patel Estate, Opp. Sahajanand Avenue, Opp. Muktidham Estate, Jivanwadi, Nikol Gam Road',
    city: 'Ahmedabad - 382350, Gujarat, India',
    phone: '+91 9426082500',
    email: 'yamunaplastic@yahoo.com',
    udyam: 'UDYAM-GJ-01-0051476 (Small Enterprise)',
    gstin: '24AKNPP7596H1ZF',
    state: 'Gujarat',
    stateCode: '24',
    pan: 'AKNPP7596H',
    bankName: 'The Karnavati Co-Op.Bank Ltd.',
    bankBranch: 'Bapunagar, Ahmedabad',
    bankAccountNo: '124002005002108',
    bankIfsc: 'GSCB0UTKCBL'
  };

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
        setSyncMsg({ type: 'success', text: `✅ ${res.message || 'Synced to Tally Prime Sales Day Book successfully!'}` });
        if (onSynced) onSynced(currentInv.id);
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
  const primaryUnit = items[0]?.unit || 'KGS';
  const isInterstate = Boolean(currentInv.isInterstate);

  // Bill To (Buyer) details
  const billTo = {
    name: currentInv.partyName || 'Cash Customer',
    gstin: currentInv.gstin || 'Unregistered',
    address: currentInv.address || 'GIDC Industrial Area',
    state: currentInv.state || 'Gujarat',
    stateCode: currentInv.stateCode || '24',
    phone: currentInv.phone || ''
  };

  // Ship To (Consignee) details
  const shipTo = {
    name: currentInv.shipTo?.name || billTo.name,
    gstin: currentInv.shipTo?.gstin || billTo.gstin,
    address: currentInv.shipTo?.address || billTo.address,
    state: currentInv.shipTo?.state || billTo.state,
    stateCode: currentInv.shipTo?.stateCode || billTo.stateCode,
    phone: currentInv.shipTo?.phone || billTo.phone
  };

  const totalTaxAmount = Number(currentInv.totalGst || (Number(currentInv.totalCgst || 0) + Number(currentInv.totalSgst || 0) + Number(currentInv.totalIgst || 0)));
  const taxInWords = numberToWords(Math.round(totalTaxAmount));
  const grandTotalInWords = currentInv.amountInWords || numberToWords(currentInv.grandTotal);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog invoice-preview-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Control Bar (Screen only) */}
        <div className="modal-header no-print">
          <div className="modal-title-wrap">
            <span className="modal-title-icon">📄</span>
            <div>
              <div className="modal-title">Tax Invoice #{currentInv.invoiceNo}</div>
              <div className="modal-subtitle">Yamuna Plastics · Factory Sales Invoice</div>
            </div>
          </div>

          <div className="invoice-copy-selector-bar">
            <span className="copy-label">Print Copy:</span>
            {['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'].map((label) => (
              <button
                key={label}
                type="button"
                className={`btn-copy-chip ${copyType === label ? 'active' : ''}`}
                onClick={() => setCopyType(label)}
              >
                {label.split(' ')[0]}
              </button>
            ))}
          </div>

          <button className="btn-close-modal-icon" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>

        {/* Sync message banner (Screen only) */}
        {syncMsg && (
          <div className={`invoice-sync-alert no-print ${syncMsg.type}`}>
            {syncMsg.text}
          </div>
        )}

        {/* Modal Body / Executive GST Printable Invoice Sheet */}
        <div className="modal-body invoice-sheet-wrapper">
          <div className="executive-invoice-sheet" id="printable-invoice">
            {/* 1. Sheet Header Banner */}
            <div className="sheet-top-title-bar">
              <div className="invoice-main-heading">TAX INVOICE</div>
              <div className="invoice-copy-tag">({copyType})</div>
            </div>

            {/* 2. Company Information Block */}
            <div className="sheet-company-header">
              <div className="company-branding">
                <h1 className="company-legal-name">{company.name}</h1>
                <div className="company-tagline">{company.tagline}</div>
                <div className="company-address-line">{company.address}, {company.city}</div>
                <div className="company-contact-line">
                  <span><strong>Mobile:</strong> {company.phone}</span>
                  <span><strong>Email:</strong> {company.email}</span>
                  <span><strong>UDYAM:</strong> {company.udyam}</span>
                </div>
              </div>
              <div className="company-tax-id-box">
                <div className="tax-id-row">
                  <span className="id-label">GSTIN:</span>
                  <span className="id-value bold">{company.gstin}</span>
                </div>
                <div className="tax-id-row">
                  <span className="id-label">PAN:</span>
                  <span className="id-value">{company.pan}</span>
                </div>
                <div className="tax-id-row">
                  <span className="id-label">State:</span>
                  <span className="id-value">{company.state} (Code: {company.stateCode})</span>
                </div>
              </div>
            </div>

            {/* Optional e-Way Bill Notification Strip */}
            {(currentInv.ewayBill?.ewayBillNo || currentInv.ewayBillNo) && (
              <div className="sheet-ewaybill-strip">
                <div className="ewb-num">
                  <span className="ewb-lbl">e-Way Bill No:</span>
                  <strong>{currentInv.ewayBill?.ewayBillNo || currentInv.ewayBillNo}</strong>
                </div>
                <div className="ewb-meta">
                  <span><strong>Date:</strong> {currentInv.ewayBill?.ewayBillDate || currentInv.date}</span>
                  <span><strong>Valid Until:</strong> {currentInv.ewayBill?.validUntil || '2 Days'}</span>
                  {currentInv.vehicleNo && <span><strong>Vehicle:</strong> {currentInv.vehicleNo}</span>}
                </div>
              </div>
            )}

            {/* 3. Invoice & Dispatch Meta Grid */}
            <div className="sheet-meta-grid">
              <div className="meta-col">
                <div className="meta-item">
                  <span className="meta-label">Invoice No:</span>
                  <span className="meta-val invoice-no-highlight">{currentInv.invoiceNo}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Invoice Date:</span>
                  <span className="meta-val">{currentInv.date}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Place of Supply:</span>
                  <span className="meta-val">{currentInv.placeOfSupply || billTo.state} ({billTo.stateCode})</span>
                </div>
              </div>

              <div className="meta-col">
                <div className="meta-item">
                  <span className="meta-label">Payment Terms:</span>
                  <span className="meta-val">{currentInv.paymentMode || 'Credit 30 Days'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due Date:</span>
                  <span className="meta-val">{currentInv.dueDate || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Reverse Charge:</span>
                  <span className="meta-val">No</span>
                </div>
              </div>

              <div className="meta-col">
                <div className="meta-item">
                  <span className="meta-label">Vehicle No:</span>
                  <span className="meta-val bold">{currentInv.vehicleNo || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Transporter:</span>
                  <span className="meta-val">{currentInv.transporter || '-'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Destination:</span>
                  <span className="meta-val">{currentInv.destination || shipTo.address || '-'}</span>
                </div>
              </div>

              <div className="meta-col">
                <div className="meta-item">
                  <span className="meta-label">Challan / Note No:</span>
                  <span className="meta-val">{currentInv.deliveryNote || currentInv.invoiceNo}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Challan Date:</span>
                  <span className="meta-val">{currentInv.deliveryNoteDate || currentInv.date}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Dispatch Doc No:</span>
                  <span className="meta-val">{currentInv.dispatchDocNo || '-'}</span>
                </div>
              </div>
            </div>

            {/* 4. SIDE-BY-SIDE PARTY BOXES: BILL TO (BUYER) vs SHIP TO (CONSIGNEE) */}
            <div className="sheet-party-dual-grid">
              {/* LEFT BOX: BILL TO (BUYER) */}
              <div className="party-dual-box bill-to-box">
                <div className="party-box-title">
                  <span className="box-title-icon">🏢</span>
                  <span>DETAILS OF RECEIVER | BILLED TO:</span>
                </div>
                <div className="party-box-body">
                  <div className="party-entity-name">{billTo.name}</div>
                  <div className="party-address-block">{billTo.address}</div>
                  <div className="party-tax-specs">
                    <div className="spec-row">
                      <span className="spec-label">GSTIN / UIN:</span>
                      <strong className="spec-value">{billTo.gstin}</strong>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">State Name:</span>
                      <span className="spec-value">{billTo.state} (State Code: {billTo.stateCode})</span>
                    </div>
                    {billTo.phone && (
                      <div className="spec-row">
                        <span className="spec-label">Contact No:</span>
                        <span className="spec-value">{billTo.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT BOX: SHIP TO (CONSIGNEE) */}
              <div className="party-dual-box ship-to-box">
                <div className="party-box-title">
                  <span className="box-title-icon">🚚</span>
                  <span>DETAILS OF CONSIGNEE | SHIPPED TO:</span>
                </div>
                <div className="party-box-body">
                  <div className="party-entity-name">{shipTo.name}</div>
                  <div className="party-address-block">{shipTo.address}</div>
                  <div className="party-tax-specs">
                    <div className="spec-row">
                      <span className="spec-label">GSTIN / UIN:</span>
                      <strong className="spec-value">{shipTo.gstin}</strong>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Delivery State:</span>
                      <span className="spec-value">{shipTo.state} (State Code: {shipTo.stateCode})</span>
                    </div>
                    {shipTo.phone && (
                      <div className="spec-row">
                        <span className="spec-label">Site Contact:</span>
                        <span className="spec-value">{shipTo.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Itemized Table of Goods */}
            <div className="sheet-items-table-wrapper">
              <table className="sheet-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center' }}>Sr</th>
                    <th style={{ textAlign: 'left' }}>Description of Goods</th>
                    <th style={{ width: '75px', textAlign: 'center' }}>HSN/SAC</th>
                    <th style={{ width: '85px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '45px', textAlign: 'center' }}>Unit</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ width: '55px', textAlign: 'right' }}>Disc%</th>
                    <th style={{ width: '95px', textAlign: 'right' }}>Taxable Amt (₹)</th>
                    {!isInterstate ? (
                      <>
                        <th style={{ width: '70px', textAlign: 'right' }}>CGST (₹)</th>
                        <th style={{ width: '70px', textAlign: 'right' }}>SGST (₹)</th>
                      </>
                    ) : (
                      <th style={{ width: '90px', textAlign: 'right' }}>IGST (₹)</th>
                    )}
                    <th style={{ width: '105px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const qty = Number(it.qty || 0);
                    const rate = Number(it.rate || 0);
                    const discPct = Number(it.discountPct || 0);
                    const taxable = Number(it.taxableAmount || (qty * rate * (1 - discPct / 100)));
                    const cgst = Number(it.cgstAmount || (!isInterstate ? (taxable * 0.09) : 0));
                    const sgst = Number(it.sgstAmount || (!isInterstate ? (taxable * 0.09) : 0));
                    const igst = Number(it.igstAmount || (isInterstate ? (taxable * 0.18) : 0));
                    const rowTot = Number(it.total || (taxable + cgst + sgst + igst));

                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{it.name}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsn || '39232100'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {qty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>{it.unit || 'KGS'}</td>
                        <td style={{ textAlign: 'right' }}>{rate.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{discPct > 0 ? `${discPct}%` : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {!isInterstate ? (
                          <>
                            <td style={{ textAlign: 'right' }}>
                              {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </>
                        ) : (
                          <td style={{ textAlign: 'right' }}>
                            {igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {rowTot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subtotal summary row */}
                  <tr className="table-subtotal-row">
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>
                      Subtotal / Total Quantity:
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {totalQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{primaryUnit}</td>
                    <td colSpan={2}></td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {Number(currentInv.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {!isInterstate ? (
                      <>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {Number(currentInv.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {Number(currentInv.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    ) : (
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        {Number(currentInv.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {Number(currentInv.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 6. HSN / Tax Breakdown Summary Table */}
            <div className="sheet-hsn-tax-wrapper">
              <table className="sheet-hsn-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ textAlign: 'center', width: '90px' }}>HSN / SAC</th>
                    <th rowSpan={2} style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
                    {!isInterstate ? (
                      <>
                        <th colSpan={2} style={{ textAlign: 'center' }}>Central Tax (CGST)</th>
                        <th colSpan={2} style={{ textAlign: 'center' }}>State Tax (SGST)</th>
                      </>
                    ) : (
                      <th colSpan={2} style={{ textAlign: 'center' }}>Integrated Tax (IGST)</th>
                    )}
                    <th rowSpan={2} style={{ textAlign: 'right', width: '110px' }}>Total Tax (₹)</th>
                  </tr>
                  <tr>
                    {!isInterstate ? (
                      <>
                        <th style={{ textAlign: 'center', width: '50px' }}>Rate</th>
                        <th style={{ textAlign: 'right', width: '80px' }}>Amount (₹)</th>
                        <th style={{ textAlign: 'center', width: '50px' }}>Rate</th>
                        <th style={{ textAlign: 'right', width: '80px' }}>Amount (₹)</th>
                      </>
                    ) : (
                      <>
                        <th style={{ textAlign: 'center', width: '60px' }}>Rate</th>
                        <th style={{ textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                      {items[0]?.hsn || '39232100'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {Number(currentInv.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {!isInterstate ? (
                      <>
                        <td style={{ textAlign: 'center' }}>9%</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(currentInv.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>9%</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(currentInv.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'center' }}>18%</td>
                        <td style={{ textAlign: 'right' }}>
                          {Number(currentInv.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="hsn-total-row">
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {Number(currentInv.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {!isInterstate ? (
                      <>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {Number(currentInv.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {Number(currentInv.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                          {Number(currentInv.totalIgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>
                      {totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 7. Bottom Financial Summary, Bank Details, and Signatures */}
            <div className="sheet-bottom-section">
              <div className="bottom-left-panel">
                <div className="words-block">
                  <div className="words-line">
                    <span className="words-label">Invoice Amount in Words:</span>
                    <strong className="words-val">INR {grandTotalInWords}</strong>
                  </div>
                  <div className="words-line" style={{ marginTop: '3px' }}>
                    <span className="words-label">Total Tax Amount in Words:</span>
                    <span className="words-val">INR {taxInWords}</span>
                  </div>
                </div>

                <div className="bank-details-box">
                  <div className="bank-title">Company Bank Account Details:</div>
                  <div className="bank-grid">
                    <div><strong>A/c Name:</strong> {company.name}</div>
                    <div><strong>Bank Name:</strong> {company.bankName}</div>
                    <div><strong>A/c Number:</strong> {company.bankAccountNo}</div>
                    <div><strong>IFSC Code:</strong> {company.bankIfsc}</div>
                    <div style={{ gridColumn: '1 / -1' }}><strong>Branch:</strong> {company.bankBranch}</div>
                  </div>
                </div>

                <div className="terms-conditions-box">
                  <div className="terms-title">Terms &amp; Conditions:</div>
                  <ol className="terms-list">
                    <li>Goods once sold will not be taken back or exchanged under any circumstances.</li>
                    <li>Interest @ 18% per annum will be charged if bill is not paid on or before due date.</li>
                    <li>Our responsibility ceases as soon as the consignment leaves our factory premises.</li>
                    <li>All disputes subject to Ahmedabad jurisdiction only.</li>
                  </ol>
                </div>
              </div>

              <div className="bottom-right-panel">
                <div className="totals-table">
                  <div className="total-row">
                    <span>Taxable Amount:</span>
                    <strong>{formatINR(currentInv.subTotal || 0)}</strong>
                  </div>

                  {!isInterstate ? (
                    <>
                      <div className="total-row">
                        <span>Central Tax (CGST 9%):</span>
                        <span>{formatINR(currentInv.totalCgst || 0)}</span>
                      </div>
                      <div className="total-row">
                        <span>State Tax (SGST 9%):</span>
                        <span>{formatINR(currentInv.totalSgst || 0)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="total-row">
                      <span>Integrated Tax (IGST 18%):</span>
                      <span>{formatINR(currentInv.totalIgst || 0)}</span>
                    </div>
                  )}

                  {Number(currentInv.freightCharges || 0) > 0 && (
                    <div className="total-row">
                      <span>Freight &amp; Delivery:</span>
                      <span>{formatINR(currentInv.freightCharges)}</span>
                    </div>
                  )}

                  {Number(currentInv.roundOff || 0) !== 0 && (
                    <div className="total-row">
                      <span>Round Off:</span>
                      <span>{Number(currentInv.roundOff) > 0 ? `+${currentInv.roundOff}` : currentInv.roundOff}</span>
                    </div>
                  )}

                  <div className="grand-total-row">
                    <span>Grand Total:</span>
                    <span className="grand-val">{formatINR(currentInv.grandTotal)}</span>
                  </div>
                </div>

                <div className="signature-area">
                  <div className="company-sign-title">For {company.name}</div>
                  <div className="sign-space"></div>
                  <div className="sign-label">Authorised Signatory</div>
                </div>
              </div>
            </div>

            {/* 8. Declaration & Footer */}
            <div className="sheet-final-footer">
              <div className="declaration-text">
                Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and there is no additional consideration flowing directly or indirectly from the buyer.
              </div>
              <div className="computer-gen-tag">This is a Computer Generated Tax Invoice</div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Screen Actions) */}
        <div className="modal-footer no-print">
          <button className="btn-sm-action btn-print" onClick={handlePrint}>
            🖨️ Print Tax Invoice (A4)
          </button>

          <button
            className="btn-sm-action"
            disabled={fetchingEwb}
            onClick={handleFetchEwb}
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 800 }}
          >
            {fetchingEwb ? 'Fetching...' : '🚚 Pull e-Way Bill'}
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
            {syncing ? 'Pushing...' : '⚡ Push to Tally Prime'}
          </button>
        </div>
      </div>
    </div>
  );
}
