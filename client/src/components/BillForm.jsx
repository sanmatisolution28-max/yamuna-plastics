import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatINR, numberToWords } from '../utils/numberToWords';

export default function BillForm({ onBillGenerated, onViewInvoice, parties, items, settings, editingInvoice, onCancelEdit }) {
  const isEditing = Boolean(editingInvoice && editingInvoice.id);

  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyDetails, setPartyDetails] = useState({
    name: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    address: '',
    phone: '',
    placeOfSupply: 'Gujarat'
  });

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState('Credit 30 Days');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transporter, setTransporter] = useState('');
  const [destination, setDestination] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryNoteDate, setDeliveryNoteDate] = useState('');
  const [distance, setDistance] = useState(85);
  const [transporterId, setTransporterId] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [notes, setNotes] = useState('');
  const [freightCharges, setFreightCharges] = useState(0);

  // Line items state
  const [lines, setLines] = useState([
    {
      id: 'line-1',
      itemId: '',
      name: '',
      hsn: '39232100',
      qty: 100,
      unit: 'KGS',
      rate: 132.00,
      discountPct: 0,
      gstRate: 18
    }
  ]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState(null);

  // Auto-fill party details when party is selected from dropdown
  const handlePartyChange = (partyId) => {
    setSelectedPartyId(partyId);
    const p = parties.find((item) => item.id === partyId);
    if (p) {
      setPartyDetails({
        name: p.name,
        gstin: p.gstin || '',
        state: p.state || 'Gujarat',
        stateCode: p.stateCode || (p.gstin ? p.gstin.slice(0, 2) : '24'),
        address: p.address || '',
        phone: p.phone || '',
        placeOfSupply: p.state || 'Gujarat'
      });
    }
  };

  // Populate from editingInvoice if present, otherwise set default party/item
  useEffect(() => {
    if (editingInvoice) {
      setSelectedPartyId(editingInvoice.partyId || '');
      setPartyDetails({
        name: editingInvoice.partyName || '',
        gstin: editingInvoice.gstin || '',
        state: editingInvoice.state || 'Gujarat',
        stateCode: editingInvoice.stateCode || '24',
        address: editingInvoice.address || '',
        phone: editingInvoice.phone || '',
        placeOfSupply: editingInvoice.placeOfSupply || 'Gujarat'
      });
      setInvoiceDate(editingInvoice.date || new Date().toISOString().slice(0, 10));
      setDueDate(editingInvoice.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setPaymentMode(editingInvoice.paymentMode || 'Credit 30 Days');
      setVehicleNo(editingInvoice.vehicleNo || '');
      setTransporter(editingInvoice.transporter || '');
      setDestination(editingInvoice.destination || '');
      setDeliveryNote(editingInvoice.deliveryNote || '');
      setDeliveryNoteDate(editingInvoice.deliveryNoteDate || '');
      setDistance(editingInvoice.distance || editingInvoice.ewayBill?.distance || 85);
      setTransporterId(editingInvoice.transporterId || editingInvoice.ewayBill?.transporterId || '');
      setEwayBillNo(editingInvoice.ewayBill?.ewayBillNo || editingInvoice.ewayBillNo || '');
      setNotes(editingInvoice.notes || '');
      setFreightCharges(editingInvoice.freightCharges || 0);

      if (editingInvoice.items && editingInvoice.items.length > 0) {
        setLines(
          editingInvoice.items.map((it, idx) => ({
            id: it.id || `line-${idx + 1}`,
            itemId: it.itemId || '',
            name: it.name || '',
            hsn: it.hsn || '',
            qty: it.qty,
            unit: it.unit || 'PCS',
            rate: it.rate,
            discountPct: it.discountPct || 0,
            gstRate: it.gstRate || 18
          }))
        );
      }
    } else {
      if (parties.length > 0 && !selectedPartyId) {
        handlePartyChange(parties[0].id);
      }
      if (items.length > 0 && lines[0] && !lines[0].itemId) {
        const it = items[0];
        setLines([
          {
            id: 'line-1',
            itemId: it.id,
            name: it.name,
            hsn: it.hsn,
            qty: 250,
            unit: it.unit,
            rate: it.baseRate,
            discountPct: 0,
            gstRate: it.gstRate
          }
        ]);
      }
    }
  }, [editingInvoice, parties, items]);

  // Is interstate supply? Gujarat state code is "24"
  const isInterstate = String(partyDetails.stateCode).trim() !== '24';

  // Add line item
  const addLine = () => {
    const defaultItem = items[0] || {
      id: '',
      name: 'Custom Plastic Product',
      hsn: '39232100',
      unit: 'KGS',
      baseRate: 120,
      gstRate: 18
    };
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        itemId: defaultItem.id,
        name: defaultItem.name,
        hsn: defaultItem.hsn,
        qty: 100,
        unit: defaultItem.unit,
        rate: defaultItem.baseRate,
        discountPct: 0,
        gstRate: defaultItem.gstRate
      }
    ]);
  };

  // Remove line item
  const removeLine = (index) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item
  const updateLine = (index, field, value) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index], [field]: value };

      // If user selected an item from dropdown, auto-populate HSN, unit, base rate, and GST rate
      if (field === 'itemId') {
        const product = items.find((it) => it.id === value);
        if (product) {
          line.name = product.name;
          line.hsn = product.hsn;
          line.unit = product.unit;
          line.rate = product.baseRate;
          line.gstRate = product.gstRate;
        }
      }
      copy[index] = line;
      return copy;
    });
  };

  // Compute live calculations
  let subTotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const computedLines = lines.map((l) => {
    const qty = Number(l.qty || 0);
    const rate = Number(l.rate || 0);
    const discountPct = Number(l.discountPct || 0);
    const gross = qty * rate;
    const discount = (gross * discountPct) / 100;
    const taxable = gross - discount;
    const gstRate = Number(l.gstRate || 18);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (!isInterstate) {
      cgst = (taxable * (gstRate / 2)) / 100;
      sgst = (taxable * (gstRate / 2)) / 100;
    } else {
      igst = (taxable * gstRate) / 100;
    }

    subTotal += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    return {
      ...l,
      taxable,
      cgst,
      sgst,
      igst,
      rowTotal: taxable + cgst + sgst + igst
    };
  });

  const freight = Number(freightCharges || 0);
  const rawGrandTotal = subTotal + totalCgst + totalSgst + totalIgst + freight;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));
  const amountWords = numberToWords(grandTotal);

  // Submit bill to backend API
  const handleGenerateBill = async (syncImmediately = false) => {
    setErrorMsg('');
    setSuccessNotice(null);

    if (!partyDetails.name.trim()) {
      setErrorMsg('Please enter or select a customer name.');
      return;
    }

    if (lines.length === 0 || lines.some((l) => !l.qty || l.qty <= 0)) {
      setErrorMsg('Please specify valid product quantities for all items.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoiceNo: isEditing ? editingInvoice.invoiceNo : undefined,
        date: invoiceDate,
        dueDate,
        partyId: selectedPartyId,
        partyName: partyDetails.name,
        gstin: partyDetails.gstin,
        state: partyDetails.state,
        stateCode: partyDetails.stateCode,
        address: partyDetails.address,
        phone: partyDetails.phone,
        placeOfSupply: partyDetails.placeOfSupply,
        destination,
        deliveryNote,
        deliveryNoteDate,
        distance: Number(distance || 85),
        transporterId,
        ewayBillNo,
        paymentMode,
        vehicleNo,
        transporter,
        items: lines,
        freightCharges: freight,
        notes
      };

      let savedInvoice;
      if (isEditing) {
        savedInvoice = await api.updateInvoice(editingInvoice.id, payload);
      } else {
        savedInvoice = await api.createInvoice(payload);
      }

      if (syncImmediately) {
        // Immediately trigger 1-Click Tally sync
        try {
          const syncRes = await api.syncInvoiceToTally(savedInvoice.id);
          if (syncRes.success) {
            setSuccessNotice({
              type: 'success',
              text: isEditing
                ? `✅ Bill #${savedInvoice.invoiceNo} successfully updated & altered in Tally Prime!`
                : `✅ Bill #${savedInvoice.invoiceNo} generated & synced to Tally Prime Sales Register!`
            });
          } else {
            setSuccessNotice({
              type: 'warning',
              text: `Bill #${savedInvoice.invoiceNo} saved. Tally Note: ${syncRes.error || syncRes.message}`
            });
          }
        } catch (tallyErr) {
          setSuccessNotice({
            type: 'warning',
            text: `Bill #${savedInvoice.invoiceNo} saved locally. (Tally Prime offline: ${tallyErr.message})`
          });
        }
      } else {
        setSuccessNotice({
          type: 'success',
          text: isEditing
            ? `🎉 Bill #${savedInvoice.invoiceNo} successfully updated!`
            : `🎉 Bill #${savedInvoice.invoiceNo} successfully generated!`
        });
      }

      if (onBillGenerated) onBillGenerated(savedInvoice);
      if (onViewInvoice) onViewInvoice(savedInvoice);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bill-form-container">
      {/* Editing Mode Notice */}
      {isEditing && (
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1.5px solid #93c5fd',
            color: '#1e40af',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✏️ Editing Bill:</span>
              <span style={{ color: '#1d4ed8', background: '#bfdbfe', padding: '2px 8px', borderRadius: '6px' }}>
                {editingInvoice.invoiceNo}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
              Changes will update local records and alter this voucher in Tally Prime.
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
                background: '#ffffff',
                border: '1px solid #93c5fd',
                color: '#1e40af',
                padding: '5px 12px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ✕ Cancel Edit
            </button>
          )}
        </div>
      )}
      {/* Success / Error Notification */}
      {successNotice && (
        <div
          style={{
            background: successNotice.type === 'success' ? '#dcfce7' : '#fef3c7',
            border: `1.5px solid ${successNotice.type === 'success' ? '#86efac' : '#fde68a'}`,
            color: successNotice.type === 'success' ? '#15803d' : '#b45309',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          {successNotice.text}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fee2e2',
            border: '1.5px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="form-grid-layout">
        {/* Left / Main Column: Party & Items */}
        <div className="form-main-column">
          {/* 1. Customer & Supply Details Card */}
          <div className="form-card">
            <div className="card-title-row">
              <div className="card-title">
                <span className="card-title-icon">👤</span>
                <span>Buyer / Party Details</span>
              </div>
              <span className={`card-badge ${isInterstate ? 'badge-interstate' : ''}`}>
                {isInterstate ? 'Inter-state (IGST 18%)' : 'Intra-state (CGST+SGST)'}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Select Existing Customer</span>
                <span className="label-sub">* Required</span>
              </label>
              <select
                className="form-select"
                value={selectedPartyId}
                onChange={(e) => handlePartyChange(e.target.value)}
              >
                <option value="">-- Choose Customer or Enter Below --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city || p.state}) - {p.gstin || 'Unregistered'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Party / Business Name</span>
                <span className="label-sub">* Required</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={partyDetails.name}
                onChange={(e) => setPartyDetails({ ...partyDetails, name: e.target.value })}
                placeholder="e.g. INSTAPLAST INDIA"
              />
            </div>

            <div className="form-row two-col">
              <div className="form-group">
                <label className="form-label">Buyer GSTIN</label>
                <input
                  type="text"
                  className="form-input"
                  value={partyDetails.gstin}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setPartyDetails({
                      ...partyDetails,
                      gstin: val,
                      stateCode: val.length >= 2 ? val.slice(0, 2) : partyDetails.stateCode
                    });
                  }}
                  placeholder="24BMZPB0466R1ZC"
                  maxLength={15}
                />
              </div>
              <div className="form-group">
                <label className="form-label">State / Place of Supply</label>
                <input
                  type="text"
                  className="form-input"
                  value={partyDetails.state}
                  onChange={(e) => setPartyDetails({ ...partyDetails, state: e.target.value, placeOfSupply: e.target.value })}
                  placeholder="Gujarat"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Billing &amp; Delivery Address</label>
              <input
                type="text"
                className="form-input"
                value={partyDetails.address}
                onChange={(e) => setPartyDetails({ ...partyDetails, address: e.target.value })}
                placeholder="Plot No., Industrial Estate, Road, City"
              />
            </div>
          </div>

          {/* 2. Product Line Items */}
          <div className="form-card">
            <div className="card-title-row">
              <div className="card-title">
                <span className="card-title-icon">📦</span>
                <span>Plastic Products ({lines.length} items)</span>
              </div>
              <button type="button" className="btn-action-outline" onClick={addLine} style={{ padding: '4px 12px', fontSize: '12px' }}>
                + Add Item
              </button>
            </div>

            {computedLines.map((line, idx) => (
              <div key={line.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>Product #{idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="btn-delete-line"
                      title="Remove Item"
                      onClick={() => removeLine(idx)}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Choose Product Catalog</label>
                  <select
                    className="form-select"
                    value={line.itemId}
                    onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                  >
                    <option value="">-- Choose Product or Type Below --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} [HSN: {it.hsn}] - ₹{it.baseRate}/{it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row three-col">
                  <div className="form-group">
                    <label className="form-label">HSN Code</label>
                    <input
                      type="text"
                      className="form-input"
                      value={line.hsn}
                      onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      className="form-input"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-select"
                      value={line.unit}
                      onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                    >
                      <option value="PCS">PCS</option>
                      <option value="KGS">KGS</option>
                      <option value="BAGS">BAGS</option>
                      <option value="ROLLS">ROLLS</option>
                      <option value="MT">MT</option>
                    </select>
                  </div>
                </div>

                <div className="form-row three-col">
                  <div className="form-group">
                    <label className="form-label">Rate (₹ / {line.unit})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={line.rate}
                      onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Disc %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="form-input"
                      value={line.discountPct}
                      onChange={(e) => updateLine(idx, 'discountPct', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST %</label>
                    <select
                      className="form-select"
                      value={line.gstRate}
                      onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                    >
                      <option value="18">18% (Standard Goods)</option>
                      <option value="12">12%</option>
                      <option value="5">5%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Taxable: {formatINR(line.taxable)} | Tax: {formatINR(line.cgst + line.sgst + line.igst)}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{formatINR(line.rowTotal)}</span>
                </div>
              </div>
            ))}

            <button type="button" className="btn-add-line" onClick={addLine}>
              <span>+ Add Another Plastic Product</span>
            </button>
          </div>

          {/* 3. Additional Charges & Notes */}
          <div className="form-card">
            <div className="card-title-row">
              <div className="card-title">
                <span className="card-title-icon">📝</span>
                <span>Additional Notes &amp; Freight</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Freight / Delivery Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                className="form-input"
                value={freightCharges}
                onChange={(e) => setFreightCharges(Number(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Invoice Notes / Dispatch Instructions</label>
              <input
                type="text"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Standard 50-micron polybags delivered to Himmatnagar plant."
              />
            </div>
          </div>
        </div>

        {/* Right / Sidebar Column: Transport, Order Meta & Summary */}
        <div className="form-sidebar-column">
          <div className="sticky-sidebar">
            {/* 4. Bill Info & Transport Card */}
            <div className="form-card">
              <div className="card-title-row">
                <div className="card-title">
                  <span className="card-title-icon">🚚</span>
                  <span>Transport &amp; Dispatch</span>
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <select
                    className="form-select"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Credit 30 Days">Credit (30 Days)</option>
                    <option value="Credit 15 Days">Credit (15 Days)</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="NEFT / Advance">NEFT / RTGS Advance</option>
                    <option value="UPI / QR Code">Immediate UPI</option>
                  </select>
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label className="form-label">Vehicle No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    placeholder="GJ-01-AB-1880"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Transporter</label>
                  <input
                    type="text"
                    className="form-input"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    placeholder="Patel Freight"
                  />
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label className="form-label">Delivery Note No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="188"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Destination</label>
                  <input
                    type="text"
                    className="form-input"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Himmatnagar"
                  />
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label className="form-label">Approx Distance (KM)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="85"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">e-Way Bill No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ewayBillNo}
                    onChange={(e) => setEwayBillNo(e.target.value)}
                    placeholder="Auto or 12-digit #"
                  />
                </div>
              </div>
            </div>

            {/* 5. Live Bill Financial Summary */}
            <div className="summary-card highlight">
              <div className="card-title-row" style={{ borderBottom: 'none', marginBottom: '8px', paddingBottom: '0' }}>
                <div className="card-title">
                  <span className="card-title-icon">💳</span>
                  <span>Invoice Financials</span>
                </div>
              </div>

              <div className="summary-row">
                <span>Sub-Total (Taxable):</span>
                <span style={{ fontWeight: 700 }}>{formatINR(subTotal)}</span>
              </div>

              {!isInterstate ? (
                <>
                  <div className="summary-row">
                    <span>CGST (9% Output):</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>+{formatINR(totalCgst)}</span>
                  </div>
                  <div className="summary-row">
                    <span>SGST (9% Output):</span>
                    <span style={{ fontWeight: 600, color: '#059669' }}>+{formatINR(totalSgst)}</span>
                  </div>
                </>
              ) : (
                <div className="summary-row">
                  <span>IGST (18% Integrated):</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>+{formatINR(totalIgst)}</span>
                </div>
              )}

              {freight > 0 && (
                <div className="summary-row">
                  <span>Freight Charges:</span>
                  <span>+{formatINR(freight)}</span>
                </div>
              )}

              {Math.abs(roundOff) > 0 && (
                <div className="summary-row">
                  <span>Round Off:</span>
                  <span>{roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
                </div>
              )}

              <div className="summary-row total">
                <span className="total-label">GRAND TOTAL:</span>
                <span className="total-amount">{formatINR(grandTotal)}</span>
              </div>

              <div className="amount-words-box">
                {amountWords}
              </div>

              {/* 6. Primary Action Buttons */}
              <div className="form-actions-group">
                <button
                  type="button"
                  className="btn-action-primary"
                  disabled={saving}
                  onClick={() => handleGenerateBill(true)}
                >
                  <span>
                    {saving
                      ? 'Communicating with Tally...'
                      : (isEditing ? '🔌 Update & Push to Tally (1-Click)' : '⚡ Save & Push to Tally (1-Click)')}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn-action-secondary"
                  disabled={saving}
                  onClick={() => handleGenerateBill(false)}
                >
                  <span>{saving ? 'Processing...' : (isEditing ? '💾 Save Updates Only' : '📄 Save & View 1:1 Print')}</span>
                </button>

                {isEditing && onCancelEdit && (
                  <button
                    type="button"
                    className="btn-action-outline"
                    onClick={onCancelEdit}
                  >
                    ✕ Discard Changes &amp; Exit Edit Mode
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
