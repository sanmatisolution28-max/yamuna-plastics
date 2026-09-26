// 1-Click Sync: Push Local Tally Prime Masters to Live Cloud Portal
const CLOUD_URL = process.env.CLOUD_URL || 'https://yamuna.sanmatisolution.com';
const TALLY_PORT = process.env.TALLY_PORT || 9000;

const xmlQuery = `<?xml version="1.0" encoding="utf-8"?>
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

async function syncTallyToCloud() {
  console.log('====================================================');
  console.log('  YAMUNA PLASTICS - TALLY PRIME 2-WAY SYNC ENGINE');
  console.log('====================================================\n');
  console.log(`[1/3] Connecting to local Tally Prime on Port ${TALLY_PORT}...`);

  try {
    const tRes = await fetch(`http://localhost:${TALLY_PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: xmlQuery,
      signal: AbortSignal.timeout(6000)
    });

    if (!tRes.ok) {
      throw new Error(`Tally responded with HTTP ${tRes.status}`);
    }

    const xml = await tRes.text();
    console.log(`[OK] Retrieved customer masters from Tally Prime (${xml.length} bytes).`);

    console.log(`\n[2/3] Updating Sundry Debtors to Live Cloud (${CLOUD_URL})...`);
    const cRes = await fetch(`${CLOUD_URL}/api/masters/tally-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: xml,
      signal: AbortSignal.timeout(10000)
    });

    const json = await cRes.json();
    if (json.success) {
      console.log(`[OK] Customer masters updated. Total active customers: ${json.partiesCount}`);
    } else {
      console.warn('[Cloud Master Notice]:', json.error || json.message);
    }

    // Step 3: Check for pending invoices created on the cloud and insert them into Tally Prime
    console.log(`\n[3/3] Checking for pending bills created on Live Cloud...`);
    try {
      const pendingRes = await fetch(`${CLOUD_URL}/api/tally/pending-bills`, {
        signal: AbortSignal.timeout(8000)
      });
      const pendingData = await pendingRes.json();
      const pendingBills = pendingData.pendingBills || [];

      if (pendingBills.length === 0) {
        console.log('  -> No pending bills on Cloud. All invoices are up to date in Tally!');
      } else {
        console.log(`  -> Found ${pendingBills.length} pending bill(s) to insert into Tally Prime.`);

        for (const bill of pendingBills) {
          console.log(`     Fetching & inserting Bill #${bill.invoiceNo} (${bill.partyName})...`);
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
            console.log(`     ✅ Bill #${bill.invoiceNo} successfully recorded in Tally Prime!`);
            await fetch(`${CLOUD_URL}/api/tally/mark-synced/${bill.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method: '1-Click Desktop Sync',
                tallyVoucherNo: bill.invoiceNo
              })
            });
          } else {
            const errMatch = tallyResp.match(/<LINEERROR>(.*?)<\/LINEERROR>/);
            console.log(`     ⚠️ Bill #${bill.invoiceNo} note: ${errMatch ? errMatch[1] : 'Check voucher formatting in Tally'}`);
          }
        }
      }
    } catch (billSyncErr) {
      console.warn('  [Notice on pending bills sync]:', billSyncErr.message);
    }

    console.log('\n====================================================');
    console.log('  🎉 2-WAY SYNC COMPLETE!');
    console.log(`  Live Portal: ${CLOUD_URL}`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ SYNC FAILED:');
    if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
      console.error(`Tally Prime is NOT listening on Port ${TALLY_PORT}.`);
      console.error('Please open Tally Prime and ensure Port 9000 is enabled in:');
      console.error('  F1: Help > Settings > Connectivity > Client/Server configuration');
    } else {
      console.error(err.message);
    }
  }
}

syncTallyToCloud();
