import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatINR, numberToWords } from '../utils/numberToWords';

export default function BillForm({
  onBillGenerated,
  onViewInvoice,
  parties = [],
  items = [],
  settings,
  editingInvoice,
  onCancelEdit,
  onRefresh
}) {
  const isEditing = Boolean(editingInvoice && editingInvoice.id);

  // Customer State
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [showCustomParty, setShowCustomParty] = useState(false);
  const [partyDetails, setPartyDetails] = useState({
    name: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    address: '',
    phone: '',
    placeOfSupply: 'Gujarat'
  });

  // Invoice Metadata
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

  // Tabular Line Items State
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
  const [syncingTally, setSyncingTally] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState(null);
  const [tallyNotice, setTallyNotice] = useState(null);

  // Filtered Debtors list for fast search
  const filteredParties = parties.filter((p) => {
    if (!partySearch.trim()) return true;
    const q = partySearch.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.gstin && p.gstin.toLowerCase().includes(q)) ||
      (p.state && p.state.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  // Fetch live masters from Tally directly from the Bill creation screen
  const handleSyncFromTally = async () => {
    setSyncingTally(true);
    setTallyNotice(null);
    try {
      const res = await api.fetchMastersFromTally();
      if (res.success) {
        setTallyNotice({
          type: 'success',
          text: `✅ ${res.message} (${res.totalParties} Customers & ${res.totalItems} Products ready)`
        });
        if (onRefresh) await onRefresh();
      } else {
        setTallyNotice({
          type: 'warning',
          text: res.error || 'Could not fetch from Tally. Make sure Tally is open on Port 9000.'
        });
      }
    } catch (err) {
      setTallyNotice({
        type: 'warning',
        text: 'Tally Prime on Port 9000 is on standby. All saved masters remain ready.'
      });
    } finally {
      setSyncingTally(false);
    }
  };

  // Auto-fill party details when customer is chosen from Tally list
  const handlePartyChange = (partyId) => {
    setSelectedPartyId(partyId);
    if (!partyId) {
      setShowCustomParty(true);
      return;
    }
    const p = parties.find((item) => item.id === partyId);
    if (p) {
      setShowCustomParty(false);
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

  // Populate from editingInvoice if present, or set default party/item
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
            unit: it.unit || 'KGS',
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
            hsn: it.hsn || '39232100',
            qty: 250,
            unit: it.unit || 'KGS',
            rate: it.baseRate || 125,
            discountPct: 0,
            gstRate: it.gstRate || 18
          }
        ]);
      }
    }
  }, [editingInvoice, parties, items]);

  // Is interstate supply? Gujarat state code is "24"
  const isInterstate = String(partyDetails.stateCode).trim() !== '24';

  // Add line item row
  const addLine = () => {
    const defaultItem = items[0] || {
      id: '',
      name: 'Plastic Material',
      hsn: '39232100',
      unit: 'KGS',
      baseRate: 125,
      gstRate: 18
    };
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        itemId: defaultItem.id,
        name: defaultItem.name,
        hsn: defaultItem.hsn || '39232100',
        qty: 100,
        unit: defaultItem.unit || 'KGS',
        rate: defaultItem.baseRate || 125,
        discountPct: 0,
        gstRate: defaultItem.gstRate || 18
      }
    ]);
  };

  // Remove line item row
  const removeLine = (index) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item field
  const updateLine = (index, field, value) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index], [field]: value };

      // When choosing product from Tally stock items, auto-fill HSN, unit, rate, and GST rate
      if (field === 'itemId') {
        const product = items.find((it) => it.id === value);
        if (product) {
          line.name = product.name;
          line.hsn = product.hsn || '39232100';
          line.unit = product.unit || 'KGS';
          line.rate = product.baseRate || 125;
          line.gstRate = product.gstRate || 18;
        }
      }
      copy[index] = line;
      return copy;
    });
  };

  // Compute live line-item calculations
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
      gross,
      discount,
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
      setErrorMsg('Please select or specify a Customer Name from Tally.');
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
        try {
          const syncRes = await api.syncInvoiceToTally(savedInvoice.id);
          if (syncRes.success) {
            setSuccessNotice({
              type: 'success',
              text: `✅ Bill #${savedInvoice.invoiceNo} successfully created & pushed to Tally Sales Register!`
            });
          } else {
            setSuccessNotice({
              type: 'warning',
              text: `Bill #${savedInvoice.invoiceNo} saved in portal. Note: ${syncRes.error || syncRes.message}`
            });
          }
        } catch (tallyErr) {
          setSuccessNotice({
            type: 'warning',
            text: `Bill #${savedInvoice.invoiceNo} saved locally in cloud. (Tally Prime offline: ${tallyErr.message})`
          });
        }
      } else {
        setSuccessNotice({
          type: 'success',
          text: isEditing
            ? `🎉 Bill #${savedInvoice.invoiceNo} updated successfully!`
            : `🎉 Bill #${savedInvoice.invoiceNo} created successfully!`
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
    <div className="billing-workbench-container">
      {/* 1. Header Toolbar Strip */}
      <div className="workbench-top-bar">
        <div className="bar-left">
          <h2>{isEditing ? `Edit Invoice #${editingInvoice.invoiceNo}` : 'Create Tax Invoice'}</h2>
          <span className="billing-tenant-chip">🏢 Yamuna Plastics · Sales Voucher</span>
        </div>

        <div className="bar-right">
          <button
            type="button"
            className="btn-sync-tally-pill"
            onClick={handleSyncFromTally}
            disabled={syncingTally}
            title="Pulls only Sundry Debtors and Stock Items from active Tally Prime"
          >
            {syncingTally ? '⏳ Fetching Tally...' : '⚡ Fetch from Tally'}
          </button>

          {isEditing && onCancelEdit && (
            <button type="button" className="btn-cancel-edit-pill" onClick={onCancelEdit}>
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Tally Notice / Alerts */}
      {tallyNotice && (
        <div className={`workbench-alert ${tallyNotice.type}`}>
          <span>{tallyNotice.text}</span>
        </div>
      )}

      {successNotice && (
        <div className={`workbench-alert ${successNotice.type}`}>
          <span>{successNotice.text}</span>
        </div>
      )}

      {errorMsg && (
        <div className="workbench-alert error">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* 2. Invoice Meta Bar (Invoice No, Dates, Terms) */}
      <div className="invoice-meta-card">
        <div className="meta-field-group">
          <label>Invoice Date</label>
          <input
            type="date"
            className="meta-input"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        <div className="meta-field-group">
          <label>Payment Terms</label>
          <select
            className="meta-select"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
          >
            <option value="Credit 30 Days">Credit 30 Days</option>
            <option value="Credit 15 Days">Credit 15 Days</option>
            <option value="Immediate / Cash">Immediate / Cash</option>
            <option value="Advance Payment">Advance Payment</option>
          </select>
        </div>

        <div className="meta-field-group">
          <label>Due Date</label>
          <input
            type="date"
            className="meta-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="meta-field-group">
          <label>Tax Treatment</label>
          <div className="tax-treatment-badge">
            {isInterstate ? '🌐 Inter-State (IGST 18%)' : '📍 Intra-State (CGST + SGST)'}
          </div>
        </div>
      </div>

      {/* 3. Customer Selection Section (Fetched directly from Tally) */}
      <div className="customer-selection-card">
        <div className="card-section-header">
          <div className="header-title">
            <span className="section-icon">🏢</span>
            <h3>Customer / Buyer Details (from Tally Prime)</h3>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="btn-text-action"
              onClick={() => setShowCustomParty(!showCustomParty)}
            >
              {showCustomParty ? '← Back to Tally Customer List' : '+ Add New / Custom Party'}
            </button>
          </div>
        </div>

        {!showCustomParty ? (
          <div className="customer-picker-row">
            <div className="customer-select-wrapper">
              <div className="picker-header-row">
                <label className="picker-label">
                  Select Customer (Sundry Debtors from Tally)
                  <span className="party-count-chip">{parties.length} in Tally</span>
                </label>
                <button
                  type="button"
                  className="btn-sync-inline-party"
                  onClick={handleSyncFromTally}
                  disabled={syncingTally}
                  title="Pulls newly created Sundry Debtors from Tally Prime (Port 9000)"
                >
                  {syncingTally ? '⏳ Syncing...' : '⚡ Sync from Tally'}
                </button>
              </div>

              {parties.length > 2 && (
                <div className="customer-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="customer-filter-input"
                    placeholder="Search by customer name, GSTIN, or city..."
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                  />
                  {partySearch && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setPartySearch('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              <select
                className="customer-select-large"
                value={selectedPartyId}
                onChange={(e) => handlePartyChange(e.target.value)}
              >
                <option value="">-- Choose Customer from Tally Masters --</option>
                {filteredParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `[GSTIN: ${p.gstin}]` : ''} - {p.state || 'Gujarat'}
                  </option>
                ))}
              </select>

              {filteredParties.length === 0 && parties.length > 0 && (
                <p className="no-matches-hint">
                  No customer matches "{partySearch}". Try clearing your search filter.
                </p>
              )}

              {parties.length === 0 && (
                <div className="no-parties-banner">
                  <span>No customers found yet. Click <strong>"⚡ Sync from Tally"</strong> to pull all Sundry Debtors from Tally Prime.</span>
                </div>
              )}
            </div>

            {/* Verified Customer Card */}
            {partyDetails.name && (
              <div className="customer-verified-card">
                <div className="verified-header">
                  <div className="verified-name-group">
                    <span className="customer-business-name">{partyDetails.name}</span>
                    <span className="customer-source-pill">Tally Prime · Sundry Debtor</span>
                  </div>
                  <span className="badge-gstin-verified">
                    {partyDetails.gstin ? `GSTIN: ${partyDetails.gstin}` : 'Unregistered Consumer'}
                  </span>
                </div>
                <div className="verified-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Billing Address:</span>
                    <span className="detail-value">{partyDetails.address || 'GIDC Industrial Area'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">State / Place of Supply:</span>
                    <span className="detail-value">
                      {partyDetails.state} (Code: {partyDetails.stateCode})
                    </span>
                  </div>
                  {partyDetails.phone && (
                    <div className="detail-item">
                      <span className="detail-label">Contact:</span>
                      <span className="detail-value">{partyDetails.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Manual / Custom Party Entry if needed */
          <div className="custom-party-form-grid">
            <div className="form-col-group">
              <label>Customer / Firm Name <span className="req">*</span></label>
              <input
                type="text"
                className="clean-input"
                placeholder="e.g. Maruti Granules Pvt. Ltd."
                value={partyDetails.name}
                onChange={(e) => setPartyDetails({ ...partyDetails, name: e.target.value })}
                required
              />
            </div>
            <div className="form-col-group">
              <label>GSTIN Number</label>
              <input
                type="text"
                className="clean-input"
                placeholder="24AAFCY1234F1Z5"
                maxLength={15}
                value={partyDetails.gstin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setPartyDetails({
                    ...partyDetails,
                    gstin: val,
                    stateCode: val.length >= 2 ? val.slice(0, 2) : partyDetails.stateCode
                  });
                }}
              />
            </div>
            <div className="form-col-group full-width">
              <label>Billing &amp; Delivery Address</label>
              <input
                type="text"
                className="clean-input"
                placeholder="Plot / Shed No, GIDC Estate, City"
                value={partyDetails.address}
                onChange={(e) => setPartyDetails({ ...partyDetails, address: e.target.value })}
              />
            </div>
            <div className="form-col-group">
              <label>State / Region</label>
              <input
                type="text"
                className="clean-input"
                value={partyDetails.state}
                onChange={(e) => setPartyDetails({ ...partyDetails, state: e.target.value, placeOfSupply: e.target.value })}
              />
            </div>
            <div className="form-col-group">
              <label>Phone / Mobile</label>
              <input
                type="text"
                className="clean-input"
                placeholder="+91 98250..."
                value={partyDetails.phone}
                onChange={(e) => setPartyDetails({ ...partyDetails, phone: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Products Table (Tabular Data Grid - 1 Row Per Item) */}
      <div className="products-table-card">
        <div className="card-section-header">
          <div className="header-title">
            <span className="section-icon">📦</span>
            <h3>Product Line Items ({lines.length} items)</h3>
          </div>
          <button type="button" className="btn-table-add-row" onClick={addLine}>
            + Add Product Row
          </button>
        </div>

        <div className="table-responsive-wrapper">
          <table className="items-data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '32%' }}>Product Name (from Tally)</th>
                <th style={{ width: '12%' }}>HSN Code</th>
                <th style={{ width: '10%' }}>Qty</th>
                <th style={{ width: '10%' }}>Unit</th>
                <th style={{ width: '12%' }}>Rate (₹)</th>
                <th style={{ width: '8%' }}>Disc %</th>
                <th style={{ width: '12%' }}>Taxable (₹)</th>
                <th style={{ width: '10%' }}>GST</th>
                <th style={{ width: '14%' }}>Total (₹)</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {computedLines.map((line, idx) => (
                <tr key={line.id} className="item-table-row">
                  <td className="row-index">{idx + 1}</td>

                  {/* Product Selector */}
                  <td>
                    <select
                      className="table-cell-select"
                      value={line.itemId}
                      onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                    >
                      <option value="">-- Choose Product --</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} [{it.unit || 'KGS'}] - ₹{it.baseRate}
                        </option>
                      ))}
                    </select>
                    {!line.itemId && (
                      <input
                        type="text"
                        className="table-cell-input-sub"
                        placeholder="Or custom item name"
                        value={line.name}
                        onChange={(e) => updateLine(idx, 'name', e.target.value)}
                      />
                    )}
                  </td>

                  {/* HSN */}
                  <td>
                    <input
                      type="text"
                      className="table-cell-input"
                      value={line.hsn}
                      onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                    />
                  </td>

                  {/* Qty */}
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      className="table-cell-input bold"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                    />
                  </td>

                  {/* Unit */}
                  <td>
                    <select
                      className="table-cell-select"
                      value={line.unit}
                      onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                    >
                      <option value="KGS">KGS</option>
                      <option value="PCS">PCS</option>
                      <option value="ROLLS">ROLLS</option>
                      <option value="BAGS">BAGS</option>
                      <option value="BOX">BOX</option>
                      <option value="MT">MT</option>
                    </select>
                  </td>

                  {/* Rate */}
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="table-cell-input font-mono"
                      value={line.rate}
                      onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                    />
                  </td>

                  {/* Disc % */}
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="table-cell-input"
                      value={line.discountPct}
                      onChange={(e) => updateLine(idx, 'discountPct', e.target.value)}
                    />
                  </td>

                  {/* Taxable Amt */}
                  <td className="table-cell-numeric">
                    {formatINR(line.taxable)}
                  </td>

                  {/* GST % */}
                  <td>
                    <select
                      className="table-cell-select"
                      value={line.gstRate}
                      onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                    >
                      <option value={18}>18%</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>

                  {/* Row Total */}
                  <td className="table-cell-numeric bold highlight">
                    {formatINR(line.rowTotal)}
                  </td>

                  {/* Delete Row */}
                  <td>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="btn-table-row-delete"
                        onClick={() => removeLine(idx)}
                        title="Delete Line"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer-action-bar">
          <button type="button" className="btn-add-line-outline" onClick={addLine}>
            + Add Another Product
          </button>
        </div>
      </div>

      {/* 5. Dispatch, Transport & E-Way Bill Strip */}
      <div className="dispatch-strip-card">
        <div className="card-section-header">
          <div className="header-title">
            <span className="section-icon">🚚</span>
            <h3>Dispatch &amp; Transport Details (e-Way Bill Option 1)</h3>
          </div>
        </div>

        <div className="dispatch-grid-four">
          <div className="dispatch-col">
            <label>Vehicle Number</label>
            <input
              type="text"
              className="clean-input"
              placeholder="e.g. GJ-03-BW-4412"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
            />
          </div>

          <div className="dispatch-col">
            <label>Transporter Name</label>
            <input
              type="text"
              className="clean-input"
              placeholder="e.g. VRL Logistics"
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
            />
          </div>

          <div className="dispatch-col">
            <label>Approx Distance (km)</label>
            <input
              type="number"
              className="clean-input"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>

          <div className="dispatch-col">
            <label>Delivery Note / Challan No.</label>
            <input
              type="text"
              className="clean-input"
              placeholder="e.g. DN-186"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 6. Invoice Summary & Grand Total Card */}
      <div className="invoice-summary-card">
        <div className="summary-left-col">
          <div className="summary-group">
            <label>Freight / Delivery Charges (₹)</label>
            <input
              type="number"
              className="clean-input"
              style={{ maxWidth: '240px' }}
              value={freightCharges}
              onChange={(e) => setFreightCharges(Number(e.target.value))}
            />
          </div>

          <div className="summary-group" style={{ marginTop: '14px' }}>
            <label>Order Notes / Terms</label>
            <textarea
              className="clean-textarea"
              rows={2}
              placeholder="Goods once sold will not be taken back. Interest @18% will be charged if payment is delayed."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>

          <div className="amount-words-banner">
            <span className="words-label">Amount in Words:</span>
            <span className="words-text">{amountWords}</span>
          </div>
        </div>

        <div className="summary-right-col">
          <div className="summary-row">
            <span>Taxable Subtotal:</span>
            <strong>{formatINR(subTotal)}</strong>
          </div>

          {!isInterstate ? (
            <>
              <div className="summary-row">
                <span>Central GST (CGST):</span>
                <span>{formatINR(totalCgst)}</span>
              </div>
              <div className="summary-row">
                <span>State GST (SGST):</span>
                <span>{formatINR(totalSgst)}</span>
              </div>
            </>
          ) : (
            <div className="summary-row">
              <span>Integrated GST (IGST 18%):</span>
              <span>{formatINR(totalIgst)}</span>
            </div>
          )}

          {freight > 0 && (
            <div className="summary-row">
              <span>Freight / Shipping:</span>
              <span>{formatINR(freight)}</span>
            </div>
          )}

          {roundOff !== 0 && (
            <div className="summary-row">
              <span>Round Off:</span>
              <span>{roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
            </div>
          )}

          <div className="summary-grand-total-row">
            <span>Grand Total:</span>
            <span className="grand-total-value">{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* 7. Bottom Fixed / Sticky Action Bar */}
      <div className="workbench-bottom-actions">
        <div className="action-hint">
          <span>⚡ Auto Option 1: Zero-Click Tally Sync &amp; e-Way Bill Active</span>
        </div>

        <div className="action-buttons-group">
          <button
            type="button"
            className="btn-action-tally-push"
            onClick={() => handleGenerateBill(true)}
            disabled={saving}
          >
            {saving ? '⏳ Saving & Syncing...' : '⚡ Save & Push to Tally (1-Click)'}
          </button>

          <button
            type="button"
            className="btn-action-save-local"
            onClick={() => handleGenerateBill(false)}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save Bill (Local)'}
          </button>
        </div>
      </div>
    </div>
  );
}
