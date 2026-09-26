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
  preselectedPartyId,
  onCancelEdit,
  onRefresh
}) {
  const isEditing = Boolean(editingInvoice && editingInvoice.id);

  // 1. Bill To (Buyer) Details
  const [selectedPartyId, setSelectedPartyId] = useState(preselectedPartyId || '');
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

  // 2. Ship To (Consignee) Details
  const [sameAsBillTo, setSameAsBillTo] = useState(true);
  const [shipToDetails, setShipToDetails] = useState({
    name: '',
    gstin: '',
    state: 'Gujarat',
    stateCode: '24',
    address: '',
    phone: ''
  });

  // 3. Invoice Metadata
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

  // 4. Tabular Line Items State
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

  // Filtered Debtors list for search
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

  // Fetch live masters from Tally directly (1-click from software)
  const handleSyncFromTally = async () => {
    setSyncingTally(true);
    setTallyNotice(null);
    try {
      const res = await api.triggerUniversalTallySync();
      if (res.success) {
        setTallyNotice({
          type: 'success',
          text: `✅ ${res.message || 'Customer Debtors synced from Tally Prime!'} (${res.totalParties || parties.length} Customers ready)`
        });
        if (onRefresh) await onRefresh();
      } else {
        setTallyNotice({
          type: 'warning',
          text: res.error || 'Could not fetch from Tally. Make sure Tally Prime is open on Port 9000.'
        });
      }
    } catch (err) {
      setTallyNotice({
        type: 'warning',
        text: err.message || 'Could not connect to Tally Prime. Ensure Tally Prime is open on your PC.'
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
      const newBillTo = {
        name: p.name,
        gstin: p.gstin || '',
        state: p.state || 'Gujarat',
        stateCode: p.stateCode || (p.gstin ? p.gstin.slice(0, 2) : '24'),
        address: p.address || '',
        phone: p.phone || '',
        placeOfSupply: p.state || 'Gujarat'
      };
      setPartyDetails(newBillTo);

      if (sameAsBillTo) {
        setShipToDetails({
          name: newBillTo.name,
          gstin: newBillTo.gstin,
          state: newBillTo.state,
          stateCode: newBillTo.stateCode,
          address: newBillTo.address,
          phone: newBillTo.phone
        });
      }
    }
  };

  // Copy Bill To details into Ship To fields
  const handleCopyBillToToShipTo = () => {
    setShipToDetails({
      name: partyDetails.name,
      gstin: partyDetails.gstin,
      state: partyDetails.state,
      stateCode: partyDetails.stateCode,
      address: partyDetails.address,
      phone: partyDetails.phone
    });
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

      if (editingInvoice.shipTo) {
        setShipToDetails({
          name: editingInvoice.shipTo.name || editingInvoice.partyName || '',
          gstin: editingInvoice.shipTo.gstin || '',
          state: editingInvoice.shipTo.state || 'Gujarat',
          stateCode: editingInvoice.shipTo.stateCode || '24',
          address: editingInvoice.shipTo.address || '',
          phone: editingInvoice.shipTo.phone || ''
        });

        const isDifferent =
          (editingInvoice.shipTo.address && editingInvoice.shipTo.address !== editingInvoice.address) ||
          (editingInvoice.shipTo.name && editingInvoice.shipTo.name !== editingInvoice.partyName);
        setSameAsBillTo(!isDifferent);
      } else {
        setSameAsBillTo(true);
        setShipToDetails({
          name: editingInvoice.partyName || '',
          gstin: editingInvoice.gstin || '',
          state: editingInvoice.state || 'Gujarat',
          stateCode: editingInvoice.stateCode || '24',
          address: editingInvoice.address || '',
          phone: editingInvoice.phone || ''
        });
      }

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
    } else if (preselectedPartyId) {
      handlePartyChange(preselectedPartyId);
    } else if (parties.length > 0 && !selectedPartyId) {
      handlePartyChange(parties[0].id);
    }

    if (!editingInvoice && items.length > 0) {
      setLines((prev) => {
        if (prev.length === 1 && !prev[0].name) {
          const first = items[0];
          return [{
            id: 'line-1',
            itemId: first.id || '',
            name: first.name,
            hsn: first.hsn || '39232100',
            qty: 100,
            unit: first.unit || 'KGS',
            rate: Number(first.baseRate || first.rate || 0),
            discountPct: 0,
            gstRate: Number(first.gstRate || 18)
          }];
        }
        return prev;
      });
    }
  }, [editingInvoice, preselectedPartyId, parties, items]);

  // Is interstate supply? Gujarat state code is "24"
  const isInterstate = String(partyDetails.stateCode).trim() !== '24';

  // Add line item row with dynamic default from Tally items
  const addLine = () => {
    const defaultItem = items && items.length > 0 ? items[0] : null;
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        itemId: defaultItem ? (defaultItem.id || '') : '',
        name: defaultItem ? defaultItem.name : '',
        hsn: defaultItem ? (defaultItem.hsn || '39232100') : '39232100',
        qty: 100,
        unit: defaultItem ? (defaultItem.unit || 'KGS') : 'KGS',
        rate: defaultItem ? Number(defaultItem.baseRate || defaultItem.rate || 0) : 125.00,
        discountPct: 0,
        gstRate: defaultItem ? Number(defaultItem.gstRate || 18) : 18
      }
    ]);
  };

  // Remove line item row
  const removeLine = (index) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Update line item field with automatic product rate & HSN lookup
  const updateLine = (index, field, value) => {
    setLines((prev) => {
      const copy = [...prev];
      if (field === 'name') {
        const trimmedVal = String(value || '').trim().toLowerCase();
        const matchedItem = items.find(
          (it) =>
            it.name.toLowerCase() === trimmedVal ||
            it.id === value ||
            it.name.toLowerCase().startsWith(trimmedVal)
        );

        if (matchedItem) {
          copy[index] = {
            ...copy[index],
            name: matchedItem.name,
            itemId: matchedItem.id,
            hsn: matchedItem.hsn || copy[index].hsn || '39232100',
            unit: matchedItem.unit || copy[index].unit || 'KGS',
            rate: Number(matchedItem.baseRate || matchedItem.rate || copy[index].rate || 0),
            gstRate: Number(matchedItem.gstRate || copy[index].gstRate || 18)
          };
        } else {
          copy[index] = { ...copy[index], name: value };
        }
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
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
      setErrorMsg('Please select or specify a Customer Name for Bill To.');
      return;
    }

    if (!sameAsBillTo && !shipToDetails.name.trim()) {
      setErrorMsg('Please specify Consignee / Delivery Plant Name for Ship To.');
      return;
    }

    if (lines.length === 0 || lines.some((l) => !l.qty || l.qty <= 0)) {
      setErrorMsg('Please specify valid product quantities for all items.');
      return;
    }

    setSaving(true);
    try {
      const effectiveShipTo = sameAsBillTo
        ? {
            name: partyDetails.name,
            gstin: partyDetails.gstin,
            state: partyDetails.state,
            stateCode: partyDetails.stateCode,
            address: partyDetails.address,
            phone: partyDetails.phone
          }
        : {
            name: shipToDetails.name || partyDetails.name,
            gstin: shipToDetails.gstin || partyDetails.gstin,
            state: shipToDetails.state || partyDetails.state,
            stateCode: shipToDetails.stateCode || partyDetails.stateCode,
            address: shipToDetails.address || partyDetails.address,
            phone: shipToDetails.phone || partyDetails.phone
          };

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
        placeOfSupply: partyDetails.placeOfSupply || partyDetails.state,
        sameAsBillTo,
        shipTo: effectiveShipTo,
        destination: destination || effectiveShipTo.address || '',
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
          <h2>{isEditing ? `Edit Invoice #${editingInvoice.invoiceNo}` : 'Create Bill'}</h2>
        </div>

        <div className="bar-right">
          <button
            type="button"
            className="btn-sync-tally-pill"
            onClick={handleSyncFromTally}
            disabled={syncingTally}
            title="Fetch Sundry Debtors from active Tally Prime"
          >
            {syncingTally ? '⏳ Syncing...' : '⚡ Sync Tally'}
          </button>

          {isEditing && onCancelEdit && (
            <button type="button" className="btn-cancel-edit-pill" onClick={onCancelEdit}>
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
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

      {/* 2. Invoice Meta Bar */}
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
          <label>GST Nature</label>
          <div className="tax-treatment-badge">
            {isInterstate ? '🌐 Interstate (IGST 18%)' : '📍 Intra-State (CGST + SGST)'}
          </div>
        </div>
      </div>

      {/* 3. CLEAN TWO-COLUMN PARTY SECTION: BILL TO vs SHIP TO */}
      <div className="billing-party-two-column-grid">
        {/* LEFT COLUMN: BILL TO (BUYER) */}
        <div className="party-panel-box bill-to-panel">
          <div className="party-panel-header">
            <div className="panel-title-group">
              <span className="panel-icon">🏢</span>
              <div>
                <h3 className="panel-title">BILL TO (BUYER)</h3>
                <span className="panel-subtitle">Invoiced Customer / Party Details</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-toggle-custom-party"
              onClick={() => setShowCustomParty(!showCustomParty)}
            >
              {showCustomParty ? '← Tally List' : '+ Custom Buyer'}
            </button>
          </div>

          {!showCustomParty ? (
            <div className="party-select-container">
              {parties.length > 3 && (
                <div className="customer-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="customer-filter-input"
                    placeholder="Search customer by name, GSTIN, city..."
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                  />
                  {partySearch && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setPartySearch('')}
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
                <option value="">-- Select Customer from Tally ({parties.length}) --</option>
                {filteredParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `[GSTIN: ${p.gstin}]` : ''} - {p.state || 'Gujarat'}
                  </option>
                ))}
              </select>

              {/* Verified Bill-To Card */}
              {partyDetails.name && (
                <div className="party-info-card">
                  <div className="party-name-row">
                    <span className="party-firm-name">{partyDetails.name}</span>
                    <span className="party-type-chip">Buyer</span>
                  </div>
                  <div className="party-fields-compact">
                    <div className="party-info-line">
                      <span className="info-tag">GSTIN:</span>
                      <strong className="info-val">{partyDetails.gstin || 'Unregistered'}</strong>
                    </div>
                    <div className="party-info-line">
                      <span className="info-tag">Address:</span>
                      <span className="info-val">{partyDetails.address || 'GIDC Industrial Area'}</span>
                    </div>
                    <div className="party-info-line">
                      <span className="info-tag">State:</span>
                      <span className="info-val">
                        {partyDetails.state} (Code: {partyDetails.stateCode})
                      </span>
                    </div>
                    {partyDetails.phone && (
                      <div className="party-info-line">
                        <span className="info-tag">Phone:</span>
                        <span className="info-val">{partyDetails.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="custom-party-form-compact">
              <div className="compact-form-row">
                <label>Buyer / Firm Name *</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Maruti Granules Pvt. Ltd."
                  value={partyDetails.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setPartyDetails({ ...partyDetails, name });
                    if (sameAsBillTo) {
                      setShipToDetails((prev) => ({ ...prev, name }));
                    }
                  }}
                  required
                />
              </div>

              <div className="compact-form-grid-2">
                <div>
                  <label>GSTIN Number</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="24AAFCY1234F1Z5"
                    maxLength={15}
                    value={partyDetails.gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      const code = val.length >= 2 ? val.slice(0, 2) : partyDetails.stateCode;
                      setPartyDetails({
                        ...partyDetails,
                        gstin: val,
                        stateCode: code
                      });
                      if (sameAsBillTo) {
                        setShipToDetails((prev) => ({ ...prev, gstin: val, stateCode: code }));
                      }
                    }}
                  />
                </div>
                <div>
                  <label>State Name</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={partyDetails.state}
                    onChange={(e) => {
                      setPartyDetails({
                        ...partyDetails,
                        state: e.target.value,
                        placeOfSupply: e.target.value
                      });
                      if (sameAsBillTo) {
                        setShipToDetails((prev) => ({ ...prev, state: e.target.value }));
                      }
                    }}
                  />
                </div>
              </div>

              <div className="compact-form-row">
                <label>Billing Address</label>
                <textarea
                  className="clean-textarea"
                  rows={2}
                  placeholder="Office / Billing address"
                  value={partyDetails.address}
                  onChange={(e) => {
                    const address = e.target.value;
                    setPartyDetails({ ...partyDetails, address });
                    if (sameAsBillTo) {
                      setShipToDetails((prev) => ({ ...prev, address }));
                    }
                  }}
                />
              </div>

              <div className="compact-form-row">
                <label>Contact Phone</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="+91 98250..."
                  value={partyDetails.phone}
                  onChange={(e) => {
                    const phone = e.target.value;
                    setPartyDetails({ ...partyDetails, phone });
                    if (sameAsBillTo) {
                      setShipToDetails((prev) => ({ ...prev, phone }));
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SHIP TO (CONSIGNEE) */}
        <div className={`party-panel-box ship-to-panel ${sameAsBillTo ? 'is-same-party' : 'is-different-party'}`}>
          <div className="party-panel-header">
            <div className="panel-title-group">
              <span className="panel-icon">🚚</span>
              <div>
                <h3 className="panel-title">SHIP TO (CONSIGNEE)</h3>
                <span className="panel-subtitle">Delivery / Factory Plant Address</span>
              </div>
            </div>

            {/* Clear segmented toggle */}
            <div className="shipto-segmented-switch">
              <button
                type="button"
                className={`switch-segment ${sameAsBillTo ? 'active' : ''}`}
                onClick={() => {
                  setSameAsBillTo(true);
                  setShipToDetails({
                    name: partyDetails.name,
                    gstin: partyDetails.gstin,
                    state: partyDetails.state,
                    stateCode: partyDetails.stateCode,
                    address: partyDetails.address,
                    phone: partyDetails.phone
                  });
                }}
              >
                Same as Bill To
              </button>
              <button
                type="button"
                className={`switch-segment ${!sameAsBillTo ? 'active different' : ''}`}
                onClick={() => {
                  setSameAsBillTo(false);
                  handleCopyBillToToShipTo();
                }}
              >
                Different Plant / Site
              </button>
            </div>
          </div>

          {sameAsBillTo ? (
            /* Clean preview when Same as Bill To */
            <div className="ship-to-same-container">
              <div className="same-address-badge">
                <span className="badge-icon">✓</span>
                <div>
                  <strong>Goods will be delivered to Buyer's registered address</strong>
                  <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.85 }}>
                    {partyDetails.address || 'Address matches Buyer particulars above'}
                  </div>
                </div>
              </div>

              <div className="delivery-destination-note">
                <span>Destination: <strong>{destination || partyDetails.address || 'Gujarat'}</strong></span>
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => {
                    setSameAsBillTo(false);
                    handleCopyBillToToShipTo();
                  }}
                >
                  Change to Different Plant Address
                </button>
              </div>
            </div>
          ) : (
            /* Custom Delivery Fields when Ship To is different */
            <div className="ship-to-custom-container">
              <div className="ship-to-action-row">
                <span className="custom-shipto-notice">⚡ Different Consignee Address Active</span>
                <button
                  type="button"
                  className="btn-copy-billto-sm"
                  onClick={handleCopyBillToToShipTo}
                  title="Copy details from Bill To"
                >
                  📋 Copy from Bill To
                </button>
              </div>

              <div className="custom-party-form-compact">
                <div className="compact-form-row">
                  <label>Consignee / Plant / Factory Name *</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="e.g. Maruti Granules (Morbi Factory Plant)"
                    value={shipToDetails.name}
                    onChange={(e) => setShipToDetails({ ...shipToDetails, name: e.target.value })}
                    required
                  />
                </div>

                <div className="compact-form-grid-2">
                  <div>
                    <label>Consignee GSTIN (Optional)</label>
                    <input
                      type="text"
                      className="clean-input"
                      placeholder="Leave blank if same as buyer"
                      maxLength={15}
                      value={shipToDetails.gstin}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setShipToDetails({
                          ...shipToDetails,
                          gstin: val,
                          stateCode: val.length >= 2 ? val.slice(0, 2) : shipToDetails.stateCode
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label>Delivery State &amp; Code</label>
                    <input
                      type="text"
                      className="clean-input"
                      value={shipToDetails.state}
                      onChange={(e) => setShipToDetails({ ...shipToDetails, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="compact-form-row">
                  <label>Factory / Unloading Site Address *</label>
                  <textarea
                    className="clean-textarea"
                    rows={2}
                    placeholder="Plot / Shed No, GIDC Industrial Estate, City"
                    value={shipToDetails.address}
                    onChange={(e) => setShipToDetails({ ...shipToDetails, address: e.target.value })}
                    required
                  />
                </div>

                <div className="compact-form-row">
                  <label>Site Contact / Person Phone</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="Supervisor or delivery receiver phone"
                    value={shipToDetails.phone}
                    onChange={(e) => setShipToDetails({ ...shipToDetails, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Products Table */}
      <div className="products-table-card">
        <div className="card-section-header">
          <div className="header-title">
            <span className="section-icon">📦</span>
            <h3>Product Line Items ({lines.length} items)</h3>
          </div>
          <button type="button" className="btn-table-add-row" onClick={addLine}>
            + Add Item Row
          </button>
        </div>

        <div className="table-responsive-wrapper">
          <table className="items-data-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                <th style={{ width: '34%' }}>Product Description / Item</th>
                <th style={{ width: '100px' }}>HSN/SAC</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '80px' }}>Unit</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Disc %</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Taxable (₹)</th>
                <th style={{ width: '90px' }}>GST Rate</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Total (₹)</th>
                <th style={{ width: '40px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {computedLines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="row-index">{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="table-cell-input bold"
                      placeholder="e.g. HDPE Plain Liner Bags"
                      value={line.name}
                      onChange={(e) => updateLine(idx, 'name', e.target.value)}
                      list="product-suggestions"
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="table-cell-input font-mono"
                      placeholder="39232100"
                      value={line.hsn}
                      onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="table-cell-input bold"
                      style={{ textAlign: 'right' }}
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', Number(e.target.value))}
                      required
                    />
                  </td>
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
                      <option value="MTR">MTR</option>
                      <option value="NOS">NOS</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="table-cell-input"
                      style={{ textAlign: 'right' }}
                      value={line.rate}
                      onChange={(e) => updateLine(idx, 'rate', Number(e.target.value))}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="table-cell-input"
                      style={{ textAlign: 'right' }}
                      value={line.discountPct}
                      onChange={(e) => updateLine(idx, 'discountPct', Number(e.target.value))}
                    />
                  </td>
                  <td className="table-cell-numeric">
                    {formatINR(line.taxable)}
                  </td>
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
                  <td className="table-cell-numeric bold highlight">
                    {formatINR(line.rowTotal)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
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

          <datalist id="product-suggestions">
            {items.map((it) => (
              <option
                key={it.id || it.name}
                value={it.name}
                label={`₹${it.baseRate || it.rate || 0}/${it.unit || 'KGS'} · HSN ${it.hsn || '39232100'}`}
              />
            ))}
          </datalist>
        </div>

        <div className="table-footer-action-bar">
          <button type="button" className="btn-add-line-outline" onClick={addLine}>
            + Add Another Item
          </button>
        </div>
      </div>

      {/* 5. Dispatch & Transport Details */}
      <div className="dispatch-strip-card">
        <div className="card-section-header">
          <div className="header-title">
            <span className="section-icon">🚚</span>
            <h3>Transport &amp; Dispatch Details</h3>
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
              placeholder="e.g. VRL Logistics / Patel Freight"
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
            />
          </div>

          <div className="dispatch-col">
            <label>Challan / Delivery Note</label>
            <input
              type="text"
              className="clean-input"
              placeholder="e.g. DN-186"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
            />
          </div>

          <div className="dispatch-col">
            <label>Destination City / Site</label>
            <input
              type="text"
              className="clean-input"
              placeholder="e.g. Morbi / Sanand"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
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
                <span>Central GST (CGST 9%):</span>
                <span>{formatINR(totalCgst)}</span>
              </div>
              <div className="summary-row">
                <span>State GST (SGST 9%):</span>
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

      {/* 7. Bottom Fixed Action Bar */}
      <div className="workbench-bottom-actions">
        <div className="action-hint">
          <span>⚡ Direct push to Tally Prime Sales Day Book</span>
        </div>

        <div className="action-buttons-group">
          <button
            type="button"
            className="btn-action-tally-push"
            onClick={() => handleGenerateBill(true)}
            disabled={saving}
          >
            {saving ? '⏳ Saving & Syncing...' : '⚡ Save & Push to Tally'}
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
