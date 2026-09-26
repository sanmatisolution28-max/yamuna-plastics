async function listAllVouchersSummary() {
  const queryXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Voucher</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Sanmati Solution</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Voucher">
            <TYPE>Voucher</TYPE>
            <FETCH>Date, VoucherNumber, Reference, PartyLedgerName, Amount</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await fetch('http://127.0.0.1:9000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: queryXml
    });
    const text = await res.text();
    const vchBlocks = text.split(/<VOUCHER /i).slice(1);
    console.log(`Found ${vchBlocks.length} total vouchers in Tally:`);
    vchBlocks.forEach((block, i) => {
      const d = block.match(/<DATE[^>]*>([^<]+)<\/DATE>/i)?.[1];
      const v = block.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i)?.[1];
      const r = block.match(/<REFERENCE[^>]*>([^<]+)<\/REFERENCE>/i)?.[1];
      const p = block.match(/<PARTYLEDGERNAME[^>]*>([^<]+)<\/PARTYLEDGERNAME>/i)?.[1];
      const a = block.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/i)?.[1];
      console.log(`${i + 1}. Date: ${d} | Vch#: ${v} | Ref: ${r} | Party: ${p} | Amount: ${a}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

listAllVouchersSummary();
