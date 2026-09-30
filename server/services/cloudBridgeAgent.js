/**
 * Background Cloud-to-Tally Bridge Agent
 * Runs automatically on the user's local PC inside the local server.
 * Listens for 1-click sync triggers from the web portal and keeps
 * Tally Prime & the Cloud Portal in sync in real time without any .bat execution.
 */

const CLOUD_URL = process.env.CLOUD_URL || 'https://yamuna.sanmatisolution.com';
const TALLY_PORT = process.env.TALLY_PORT || 9000;

const xmlDebtorQuery = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>DebtorCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="DebtorCollection">
            <TYPE>Ledger</TYPE>
            <CHILDOF>$$GroupSundryDebtors</CHILDOF>
            <BELONGSTO>Yes</BELONGSTO>
            <FETCH>NAME, PARENT, PARTYGSTIN, STATENAME, LEDSTATENAME, ADDRESS.LIST, ADDRESS, PINCODE, LEDGERPHONE, LEDGERMOBILE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

const xmlStockQuery = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockCollection">
            <TYPE>StockItem</TYPE>
            <FETCH>NAME, BASEUNITS, RATE, OPENINGRATE, CLOSINGRATE, HSNCODE, HSNDETAILS, GSTRATEDETAILS, STANDARDCOST, STANDARDPRICE, LASTSALERATE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

const xmlVoucherQuery = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SalesVoucherCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>20000101</SVFROMDATE>
        <SVTODATE>20991231</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SalesVoucherCollection">
            <TYPE>Voucher</TYPE>
            <FETCH>VOUCHERNUMBER, DATE, PARTYLEDGERNAME</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

let isSyncing = false;

export async function executeTallySyncCycle() {
  if (isSyncing) return { success: false, reason: 'Sync already in progress' };
  isSyncing = true;

  try {
    // 1. Pull Debtor Masters from local Tally Prime
    let debtorXml = '';
    try {
      const tallyDebtorRes = await fetch(`http://localhost:${TALLY_PORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: xmlDebtorQuery,
        signal: AbortSignal.timeout(6000)
      });
      if (tallyDebtorRes.ok) {
        debtorXml = await tallyDebtorRes.text();
      }
    } catch (dErr) {
      console.warn('[Bridge Agent] Debtor pull notice:', dErr.message);
    }

    // 2. Pull Stock Item (Products) Masters from local Tally Prime
    let stockXml = '';
    try {
      const tallyStockRes = await fetch(`http://localhost:${TALLY_PORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: xmlStockQuery,
        signal: AbortSignal.timeout(6000)
      });
      if (tallyStockRes.ok) {
        stockXml = await tallyStockRes.text();
      }
    } catch (sErr) {
      console.warn('[Bridge Agent] Stock Item pull notice:', sErr.message);
    }

    // 3. Pull Vouchers from local Tally Prime to auto-identify latest voucher number
    let voucherXml = '';
    try {
      const tallyVoucherRes = await fetch(`http://localhost:${TALLY_PORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: xmlVoucherQuery,
        signal: AbortSignal.timeout(6000)
      });
      if (tallyVoucherRes.ok) {
        voucherXml = await tallyVoucherRes.text();
      }
    } catch (vErr) {
      console.warn('[Bridge Agent] Voucher pull notice:', vErr.message);
    }

    if (!debtorXml && !stockXml && !voucherXml) {
      throw new Error(`Could not connect to Tally Prime on localhost:${TALLY_PORT}. Ensure Tally Prime is open with Connectivity enabled.`);
    }

    const combinedXml = debtorXml + '\n' + stockXml + '\n' + voucherXml;

    // 4. Push Debtors, Stock Items, and Vouchers to Live Cloud
    const cloudPushRes = await fetch(`${CLOUD_URL}/api/masters/tally-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: combinedXml,
      signal: AbortSignal.timeout(10000)
    });

    const pushData = await cloudPushRes.json().catch(() => ({}));
    const totalParties = pushData.partiesCount || 0;
    const totalItems = pushData.itemsCount || 0;
    const latestTallyVoucher = pushData.latestTallyVoucher;
    const nextInvoiceNumber = pushData.nextInvoiceNumber;

    if (latestTallyVoucher) {
      console.log(`[Bridge Agent] Identified latest voucher in Tally: #${latestTallyVoucher} -> Next voucher auto-set to #${nextInvoiceNumber}`);
    }

    // 3. Check for any pending bills created on the cloud and post them into local Tally
    let syncedBillsCount = 0;
    try {
      const pendingRes = await fetch(`${CLOUD_URL}/api/tally/pending-bills`, {
        signal: AbortSignal.timeout(8000)
      });
      const pendingData = await pendingRes.json().catch(() => ({}));
      const pendingBills = pendingData.pendingBills || [];

      for (const bill of pendingBills) {
        try {
          const vchRes = await fetch(`${CLOUD_URL}/api/tally/invoice-xml/${bill.id}`, {
            signal: AbortSignal.timeout(8000)
          });
          const vchXml = await vchRes.text();

          const tallyPost = await fetch(`http://localhost:${TALLY_PORT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
            body: vchXml,
            signal: AbortSignal.timeout(10000)
          });

          const tallyResp = await tallyPost.text();
          const created = Number((tallyResp.match(/<CREATED>(\d+)<\/CREATED>/) || [])[1] || 0);
          const altered = Number((tallyResp.match(/<ALTERED>(\d+)<\/ALTERED>/) || [])[1] || 0);
          const errors = Number((tallyResp.match(/<ERRORS>(\d+)<\/ERRORS>/) || [])[1] || 0);

          if ((created > 0 || altered > 0) && errors === 0) {
            syncedBillsCount++;
            await fetch(`${CLOUD_URL}/api/tally/mark-synced/${bill.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method: '1-Click Cloud Bridge',
                tallyVoucherNo: bill.invoiceNo
              })
            }).catch(() => {});
          }
        } catch (vchErr) {
          console.warn(`[Bridge Agent] Voucher ${bill.invoiceNo} sync notice:`, vchErr.message);
        }
      }
    } catch (pendingErr) {
      console.warn('[Bridge Agent] Pending bills check notice:', pendingErr.message);
    }

    return {
      success: true,
      totalParties,
      totalItems,
      syncedBillsCount,
      message: `Direct Tally Sync Complete: ${totalParties} Customers & ${totalItems} Products loaded!`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  } finally {
    isSyncing = false;
  }
}

export function startCloudBridgeAgent() {
  // Only run the local polling agent if running on local machine (not on Render cloud)
  if (process.env.RENDER) {
    console.log('[Bridge] Running on Render Cloud. Polling agent disabled on server.');
    return;
  }

  console.log(`[Bridge Agent] Initialized. Monitoring ${CLOUD_URL} for 1-click sync commands...`);

  // Periodic background voucher sync every 15 seconds to detect newly created Tally bills
  setInterval(async () => {
    try {
      await executeTallySyncCycle();
    } catch {
      // Quietly ignore if Tally offline
    }
  }, 15000);

  // Poll loop: checks for triggers every 2 seconds
  setInterval(async () => {
    try {
      const pollRes = await fetch(`${CLOUD_URL}/api/bridge/poll`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!pollRes.ok) return;

      const pollData = await pollRes.json();
      if (pollData && pollData.hasPending && pollData.command) {
        console.log(`[Bridge Agent] Received 1-click sync trigger from web app (Cmd: ${pollData.command.id})`);
        const result = await executeTallySyncCycle();

        await fetch(`${CLOUD_URL}/api/bridge/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commandId: pollData.command.id,
            success: result.success,
            result,
            error: result.error
          }),
          signal: AbortSignal.timeout(8000)
        }).catch(() => {});

        console.log(`[Bridge Agent] Command ${pollData.command.id} completed. Success: ${result.success}`);
      }
    } catch {
      // Quietly ignore network blips
    }
  }, 2000);
}
