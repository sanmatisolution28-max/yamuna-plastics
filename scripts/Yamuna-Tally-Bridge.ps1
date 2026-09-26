<#
=============================================================================
 Yamuna Plastics - Automated 1-Click Tally Prime Real-Time Cloud Bridge
 Works out-of-the-box on any Windows 10 / 11 PC without installing anything!
=============================================================================
#>

$CloudUrl = "https://yamuna.sanmatisolution.com"
$TallyUrl = "http://localhost:9000"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  YAMUNA PLASTICS - TALLY PRIME CLOUD BRIDGE CONNECTOR  " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Connecting to local Tally Prime on port 9000..." -ForegroundColor White

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

function Sync-TallyWithCloud {
    try {
        Write-Host "[Sync] Pulling Sundry Debtors & Products from Tally Prime..." -ForegroundColor Cyan
        
        $debtorXmlStr = ""
        try {
            $debtorResp = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $xmlDebtorQuery -ContentType "application/xml; charset=utf-8" -TimeoutSec 6
            $debtorXmlStr = if ($debtorResp -is [System.Xml.XmlDocument]) { $debtorResp.OuterXml } else { [string]$debtorResp }
        } catch {
            Write-Host "[Debtor Notice] $($_.Exception.Message)" -ForegroundColor Gray
        }

        $stockXmlStr = ""
        try {
            $stockResp = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $xmlStockQuery -ContentType "application/xml; charset=utf-8" -TimeoutSec 6
            $stockXmlStr = if ($stockResp -is [System.Xml.XmlDocument]) { $stockResp.OuterXml } else { [string]$stockResp }
        } catch {
            Write-Host "[Stock Notice] $($_.Exception.Message)" -ForegroundColor Gray
        }
        
        $combinedXml = "$debtorXmlStr`n$stockXmlStr"
        
        if ([string]::IsNullOrWhiteSpace($combinedXml)) {
            throw "Could not reach Tally Prime on port 9000. Ensure Tally Prime is open."
        }

        Write-Host "[Sync] Uploading Customers & Products to Yamuna Cloud..." -ForegroundColor Cyan
        $pushResult = Invoke-RestMethod -Uri "$CloudUrl/api/masters/tally-push" -Method Post -Body $combinedXml -ContentType "application/xml; charset=utf-8" -TimeoutSec 10
        
        Write-Host "[SUCCESS] $($pushResult.message)" -ForegroundColor Green
        
        # Pull any pending bills from cloud to Tally
        try {
            $pendingData = Invoke-RestMethod -Uri "$CloudUrl/api/tally/pending-bills" -Method Get -TimeoutSec 6
            if ($pendingData -and $pendingData.pendingBills -and $pendingData.pendingBills.Count -gt 0) {
                foreach ($bill in $pendingData.pendingBills) {
                    Write-Host "[Sync] Posting Bill #$($bill.invoiceNo) into Tally Prime..." -ForegroundColor Yellow
                    $vchXml = Invoke-RestMethod -Uri "$CloudUrl/api/tally/invoice-xml/$($bill.id)" -Method Get -TimeoutSec 6
                    $tallyPost = Invoke-RestMethod -Uri $TallyUrl -Method Post -Body $vchXml -ContentType "application/xml; charset=utf-8" -TimeoutSec 10
                    
                    if ($tallyPost -match '<CREATED>1</CREATED>' -or $tallyPost -match '<ALTERED>1</ALTERED>') {
                        Write-Host "[SUCCESS] Bill #$($bill.invoiceNo) created in Tally Prime with e-Way Bill!" -ForegroundColor Green
                        Invoke-RestMethod -Uri "$CloudUrl/api/tally/mark-synced/$($bill.id)" -Method Post -Body '{"method":"PowerShell Bridge"}' -ContentType "application/json" | Out-Null
                    }
                }
            }
        } catch {
            # Quietly skip bill posting notice
        }
        
        return @{ Success = $true; Message = $pushResult.message; PartiesCount = $pushResult.partiesCount; ItemsCount = $pushResult.itemsCount }
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Run initial sync right away on start
Write-Host "Running Initial Master Sync..." -ForegroundColor Yellow
$initial = Sync-TallyWithCloud

Write-Host ""
Write-Host ">>> Tally Prime Bridge is RUNNING in real time." -ForegroundColor Green
Write-Host ">>> You can now create bills on mobile/web and click Sync anywhere." -ForegroundColor Green
Write-Host ">>> Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Real-time polling loop (every 2 seconds)
while ($true) {
    try {
        $poll = Invoke-RestMethod -Uri "$CloudUrl/api/bridge/poll" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($poll -and $poll.hasPending -and $poll.command) {
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
        }
    } catch {
        # Quiet
    }
    Start-Sleep -Seconds 2
}
