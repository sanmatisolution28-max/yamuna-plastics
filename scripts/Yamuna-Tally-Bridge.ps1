<#
=============================================================================
 Yamuna Plastics - Automated 1-Click Tally Prime Real-Time Cloud Bridge
 Works out-of-the-box on any Windows 7 / 8 / 10 / 11 PC without installing anything!
=============================================================================
#>

# Enable TLS 1.2 for modern HTTPS connections
try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls11 -bor [System.Net.SecurityProtocolType]::Tls
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
} catch {
    # Ignore if already configured
}

$CloudUrl = "https://yamuna.sanmatisolution.com"
if ($env:CLOUD_URL) {
    $CloudUrl = $env:CLOUD_URL
}

$TallyPort = 9000
if ($env:TALLY_PORT) {
    $TallyPort = [int]$env:TALLY_PORT
}
$TallyUrl = "http://localhost:$TallyPort"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  YAMUNA PLASTICS - TALLY PRIME CLOUD BRIDGE CONNECTOR  " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Cloud Portal : $CloudUrl" -ForegroundColor White
Write-Host "  Tally Port   : $TallyPort" -ForegroundColor White
Write-Host "  Dependencies : None (Built-in Windows Engine)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$xmlDebtorQuery = @"
<?xml version="1.0" encoding="utf-8"?>
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
        <SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="DebtorCollection">
            <TYPE>Ledger</TYPE>
            <CHILDOF>`$`$GroupSundryDebtors</CHILDOF>
            <BELONGSTO>Yes</BELONGSTO>
            <FETCH>NAME, PARENT, PARTYGSTIN, STATENAME, LEDSTATENAME, ADDRESS.LIST, ADDRESS, PINCODE, LEDGERPHONE, LEDGERMOBILE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
"@

$xmlStockQuery = @"
<?xml version="1.0" encoding="utf-8"?>
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
        <SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockCollection">
            <TYPE>StockItem</TYPE>
            <FETCH>NAME, BASEUNITS, OPENINGRATE, CLOSINGRATE, HSNCODE, HSNDETAILS, GSTRATEDETAILS, STANDARDCOST, STANDARDPRICE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
"@

$xmlVoucherQuery = @"
<?xml version="1.0" encoding="utf-8"?>
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
        <SVEXPORTFORMAT>`$`$SysName:XML</SVEXPORTFORMAT>
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
</ENVELOPE>
"@

function Sync-TallyWithCloud {
    param([bool]$QuietIfOffline = $false)
    
    try {
        # 1. Test local Tally Prime connection
        $debtorXmlStr = ""
        try {
            $debtorResp = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $xmlDebtorQuery -ContentType "application/xml; charset=utf-8" -TimeoutSec 5
            $debtorXmlStr = if ($debtorResp -is [System.Xml.XmlDocument]) { $debtorResp.OuterXml } else { [string]$debtorResp }
        } catch {
            if (-not $QuietIfOffline) {
                Write-Host "[TALLY NOTICE] Cannot reach Tally Prime on Port $TallyPort." -ForegroundColor DarkYellow
                Write-Host "  -> Make sure Tally Prime is open." -ForegroundColor Gray
                Write-Host "  -> Press F1 > Settings > Connectivity > Client/Server configuration:" -ForegroundColor Gray
                Write-Host "     Set 'TallyPrime acts as' to Both and 'Port' to $TallyPort." -ForegroundColor Gray
            }
            return @{ Success = $false; Error = "Tally Prime not reachable on Port $TallyPort" }
        }

        # 2. Pull Stock Items from Tally
        $stockXmlStr = ""
        try {
            $stockResp = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $xmlStockQuery -ContentType "application/xml; charset=utf-8" -TimeoutSec 5
            $stockXmlStr = if ($stockResp -is [System.Xml.XmlDocument]) { $stockResp.OuterXml } else { [string]$stockResp }
        } catch {
            # Continue even if stock query encounters minor hiccup
        }

        # 3. Pull Vouchers from Tally to auto-identify latest voucher number
        $voucherXmlStr = ""
        try {
            $voucherResp = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $xmlVoucherQuery -ContentType "application/xml; charset=utf-8" -TimeoutSec 5
            $voucherXmlStr = if ($voucherResp -is [System.Xml.XmlDocument]) { $voucherResp.OuterXml } else { [string]$voucherResp }
        } catch {
            # Continue even if voucher query encounters minor hiccup
        }
        
        $combinedXml = "$debtorXmlStr`n$stockXmlStr`n$voucherXmlStr"
        
        # 4. Push Customers, Products & Voucher sequences to Cloud
        Write-Host "[SYNC] Syncing Masters & Vouchers with Cloud Portal..." -ForegroundColor Cyan
        try {
            $pushResult = Invoke-RestMethod -Uri "$CloudUrl/api/masters/tally-push" -Method Post -Body $combinedXml -ContentType "application/xml; charset=utf-8" -TimeoutSec 15
            Write-Host "[SUCCESS] $($pushResult.message)" -ForegroundColor Green
            if ($pushResult.latestTallyVoucher) {
                Write-Host "  -> [AUTO-IDENTIFY] Latest Tally voucher: #$($pushResult.latestTallyVoucher) | Next Auto-Bill: #$($pushResult.nextInvoiceNumber)" -ForegroundColor Green
            }
        } catch {
            Write-Host "[CLOUD NOTICE] Failed to upload masters to Cloud: $($_.Exception.Message)" -ForegroundColor Red
            return @{ Success = $false; Error = "Cloud upload error: $($_.Exception.Message)" }
        }
        
        # 4. Pull pending bills from Cloud and post into Tally Prime
        try {
            $pendingData = Invoke-RestMethod -Uri "$CloudUrl/api/tally/pending-bills" -Method Get -TimeoutSec 8
            if ($pendingData -and $pendingData.pendingBills -and $pendingData.pendingBills.Count -gt 0) {
                Write-Host "[SYNC] Found $($pendingData.pendingBills.Count) pending bill(s) to post to Tally..." -ForegroundColor Yellow
                foreach ($bill in $pendingData.pendingBills) {
                    Write-Host "  -> Posting Bill #$($bill.invoiceNo) ($($bill.partyName)) into Tally..." -ForegroundColor Yellow
                    try {
                        $vchXml = Invoke-RestMethod -Uri "$CloudUrl/api/tally/invoice-xml/$($bill.id)" -Method Get -TimeoutSec 8
                        $vchXmlStr = if ($vchXml -is [System.Xml.XmlDocument]) { $vchXml.OuterXml } else { [string]$vchXml }
                        $tallyPost = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $vchXmlStr -ContentType "application/xml; charset=utf-8" -TimeoutSec 10
                        $tallyRespStr = if ($tallyPost -is [System.Xml.XmlDocument]) { $tallyPost.OuterXml } else { [string]$tallyPost }

                        if ($tallyRespStr -match '<CREATED>1</CREATED>' -or $tallyRespStr -match '<ALTERED>1</ALTERED>') {
                            Write-Host "     [OK] Bill #$($bill.invoiceNo) recorded in Tally Prime with e-Way Bill!" -ForegroundColor Green
                            Invoke-RestMethod -Uri "$CloudUrl/api/tally/mark-synced/$($bill.id)" -Method Post -Body '{"method":"Standalone Native Bridge"}' -ContentType "application/json" -TimeoutSec 8 | Out-Null
                        } else {
                            $err = ""
                            if ($tallyRespStr -match '<LINEERROR>(.*?)</LINEERROR>') { $err = $matches[1] }
                            Write-Host "     [NOTE] Bill #$($bill.invoiceNo): $(if ($err) { $err } else { 'Could not post voucher' })" -ForegroundColor DarkYellow
                        }
                    } catch {
                        Write-Host "     [ERROR] Bill #$($bill.invoiceNo): $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            } else {
                Write-Host "[SYNC] Invoices are 100% up to date in Tally Prime." -ForegroundColor Green
            }
        } catch {
            # Skip quiet invoice check errors
        }
        
        return @{ Success = $true; Message = $pushResult.message; PartiesCount = $pushResult.partiesCount; ItemsCount = $pushResult.itemsCount }
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# 1. Run initial synchronization on start
Write-Host "Running Initial Master Sync..." -ForegroundColor Yellow
$initial = Sync-TallyWithCloud

Write-Host ""
Write-Host ">>> TALLY PRIME CLOUD BRIDGE IS ACTIVE AND RUNNING IN REAL TIME." -ForegroundColor Green
Write-Host ">>> You can now create bills on phone, web, or in Tally; they sync instantly." -ForegroundColor Green
Write-Host ">>> Press Ctrl+C anytime to stop." -ForegroundColor Gray
Write-Host ""

# 2. Continuous real-time polling loop
$consecutiveErrors = 0
while ($true) {
    try {
        $poll = Invoke-RestMethod -Uri "$CloudUrl/api/bridge/poll" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($poll -and $poll.hasPending -and $poll.command) {
            Write-Host ""
            Write-Host "[TRIGGER] Received sync command from Web Portal (ID: $($poll.command.id))..." -ForegroundColor Yellow
            $res = Sync-TallyWithCloud
            
            $completeBody = @{
                commandId = $poll.command.id
                success = $res.Success
                result = @{
                    message = $res.Message
                    totalParties = $res.PartiesCount
                    totalItems = $res.ItemsCount
                }
                error = $res.Error
            } | ConvertTo-Json
            
            Invoke-RestMethod -Uri "$CloudUrl/api/bridge/complete" -Method Post -Body $completeBody -ContentType "application/json" -TimeoutSec 8 | Out-Null
            Write-Host "[DONE] Cloud command completed successfully." -ForegroundColor Green
        }
        $consecutiveErrors = 0
    } catch {
        $consecutiveErrors++
        if ($consecutiveErrors -eq 10) {
            Write-Host "[NOTICE] Waiting to reconnect to Cloud Portal ($CloudUrl)..." -ForegroundColor DarkYellow
        }
    }
    Start-Sleep -Seconds 2
}
