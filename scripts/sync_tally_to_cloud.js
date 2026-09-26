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
  console.log('  YAMUNA PLASTICS - TALLY PRIME TO CLOUD MASTER SYNC');
  console.log('====================================================\n');
  console.log(`[1/2] Connecting to local Tally Prime on Port ${TALLY_PORT}...`);

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
    console.log(`[OK] Successfully retrieved customer data from Tally Prime (${xml.length} bytes).\n`);

    console.log(`[2/2] Pushing verified Sundry Debtors to Live Cloud (${CLOUD_URL})...`);
    const cRes = await fetch(`${CLOUD_URL}/api/masters/tally-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: xml,
      signal: AbortSignal.timeout(10000)
    });

    const json = await cRes.json();
    if (json.success) {
      console.log('\n====================================================');
      console.log('  🎉 SUCCESS! TALLY MASTERS SYNCHRONIZED TO CLOUD!');
      console.log(`  Total Customers in Live Portal: ${json.partiesCount}`);
      console.log(`  Live URL: ${CLOUD_URL}`);
      console.log('====================================================\n');
    } else {
      console.error('\n[Cloud Error]:', json.error || json.message);
    }
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
