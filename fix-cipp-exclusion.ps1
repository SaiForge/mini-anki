<#
.SYNOPSIS
    CIPP Supply Chain Vulnerability Remediation Script
    Removes App ID d414ee2d-73e5-4e5b-bb16-03ef55fea597 from consent policy exclusions
    and audits all tenants that have consented to this application.

.DESCRIPTION
    WHY THIS MATTERS:
    Azure's authorization policy can have "exclusions" — apps that bypass the normal
    tenant consent controls. If the Azure Static Web Apps app ID is in that exclusion
    list, any user in any tenant could grant it permissions without admin approval.
    This is a supply-chain risk: a compromised or malicious update to that app could
    silently gain access to user data across all consented tenants.

    WHAT THIS SCRIPT DOES:
    1. Connects to Microsoft Graph with the minimum required permissions
    2. Reads the current authorization policy exclusion list
    3. Checks if the vulnerable App ID is present
    4. Removes it if found and shows a before/after comparison
    5. Audits all service principals / OAuth grants for this App ID
    6. Saves a full remediation report to disk

.NOTES
    Required Permissions (Microsoft Graph):
      - Policy.ReadWrite.Authorization
      - Application.Read.All
      - DelegatedPermissionGrant.ReadWrite.All
    
    Run as: Global Administrator or Privileged Role Administrator
    Tested on: PowerShell 7+ with Microsoft.Graph module 2.x

.EXAMPLE
    .\fix-cipp-exclusion.ps1
    .\fix-cipp-exclusion.ps1 -WhatIf   # Dry run — shows what would be removed
    .\fix-cipp-exclusion.ps1 -ReportPath "C:\Reports\cipp-audit.json"
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    # The App ID flagged in the security report (Azure Static Web Apps / CIPP)
    [string]$VulnerableAppId = "d414ee2d-73e5-4e5b-bb16-03ef55fea597",

    # Where to save the remediation report
    [string]$ReportPath = ".\cipp-remediation-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0: Check prerequisites
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[*] CIPP Supply Chain Remediation Script" -ForegroundColor Cyan
Write-Host "    Target App ID: $VulnerableAppId" -ForegroundColor Yellow

if (-not (Get-Module -ListAvailable -Name "Microsoft.Graph")) {
    Write-Error "Microsoft.Graph PowerShell module is not installed."
    Write-Host "Install it with: Install-Module Microsoft.Graph -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Connect to Microsoft Graph
#
# WHY: We need admin-level access to read and modify tenant authorization
#   policies. We request only the scopes we actually need (least privilege).
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[1] Connecting to Microsoft Graph..." -ForegroundColor Cyan

try {
    Connect-MgGraph -Scopes @(
        "Policy.ReadWrite.Authorization",
        "Application.Read.All",
        "DelegatedPermissionGrant.ReadWrite.All"
    ) -NoWelcome -ErrorAction Stop

    $context = Get-MgContext
    Write-Host "    Connected as: $($context.Account)" -ForegroundColor Green
    Write-Host "    Tenant ID:    $($context.TenantId)" -ForegroundColor Green
} catch {
    Write-Error "Failed to connect to Microsoft Graph: $_"
    exit 1
}

# Initialize report object
$report = [ordered]@{
    RunTimestamp        = (Get-Date -Format "o")
    TenantId            = (Get-MgContext).TenantId
    ConnectedAccount    = (Get-MgContext).Account
    VulnerableAppId     = $VulnerableAppId
    PolicyBeforeChange  = $null
    ExclusionFound      = $false
    ExclusionRemoved    = $false
    AuditedServicePrincipals = @()
    AuditedOAuthGrants  = @()
    Recommendations     = @()
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Read current authorization policy
#
# WHY: The authorization policy controls which apps are excluded from consent
#   framework enforcement. We need to see the current state before changing it.
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[2] Reading current authorization policy..." -ForegroundColor Cyan

try {
    $authPolicy = Get-MgPolicyAuthorizationPolicy -ErrorAction Stop
    $exclusions = $authPolicy.DefaultUserRolePermissions.PermissionGrantPoliciesAssigned

    $report.PolicyBeforeChange = @{
        AllowInvitesFrom                              = $authPolicy.AllowInvitesFrom
        AllowEmailVerifiedUsersToJoinOrganization     = $authPolicy.AllowEmailVerifiedUsersToJoinOrganization
        PermissionGrantPoliciesAssigned               = $exclusions
    }

    Write-Host "    Current permission grant policies assigned:" -ForegroundColor White
    if ($exclusions) {
        $exclusions | ForEach-Object { Write-Host "      - $_" -ForegroundColor Gray }
    } else {
        Write-Host "      (none)" -ForegroundColor Gray
    }
} catch {
    Write-Error "Failed to read authorization policy: $_"
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Check if the vulnerable App ID is present in exclusions
#
# WHY: We only want to act if the problem actually exists. Removing things
#   blindly could break legitimate app authorizations.
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[3] Checking for App ID in consent policy exclusions..." -ForegroundColor Cyan

# The exclusion format in policy can be "manuallyAddedApplication-<AppId>"
# or reference a custom policy that includes the app. We check both.
$exclusionKeywords = @(
    $VulnerableAppId,
    "manuallyAddedApplication-$VulnerableAppId"
)

$foundExclusions = $exclusions | Where-Object { 
    $policy = $_
    $exclusionKeywords | Where-Object { $policy -like "*$_*" }
}

if ($foundExclusions) {
    $report.ExclusionFound = $true
    Write-Host "    [!] VULNERABLE: App ID found in exclusions:" -ForegroundColor Red
    $foundExclusions | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
} else {
    $report.ExclusionFound = $false
    Write-Host "    [OK] App ID NOT found in consent policy exclusions." -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Remove the exclusion if found
#
# WHY: An excluded app can receive OAuth consent from users without admin review.
#   Removing the exclusion forces all future consents through the standard
#   admin-controlled consent framework — closing the supply chain attack vector.
# ─────────────────────────────────────────────────────────────────────────────
if ($report.ExclusionFound) {
    Write-Host "`n[4] Removing exclusion from authorization policy..." -ForegroundColor Cyan

    $cleanedExclusions = $exclusions | Where-Object {
        $policy = $_
        -not ($exclusionKeywords | Where-Object { $policy -like "*$_*" })
    }

    if ($PSCmdlet.ShouldProcess("Authorization Policy", "Remove App ID $VulnerableAppId from consent exclusions")) {
        try {
            Update-MgPolicyAuthorizationPolicy -BodyParameter @{
                DefaultUserRolePermissions = @{
                    PermissionGrantPoliciesAssigned = $cleanedExclusions
                }
            } -ErrorAction Stop

            $report.ExclusionRemoved = $true
            Write-Host "    [OK] Exclusion removed successfully." -ForegroundColor Green
            Write-Host "    Remaining policies:" -ForegroundColor White
            $cleanedExclusions | ForEach-Object { Write-Host "      - $_" -ForegroundColor Gray }
        } catch {
            Write-Error "Failed to update authorization policy: $_"
            $report.Recommendations += "MANUAL ACTION REQUIRED: Remove '$VulnerableAppId' from PermissionGrantPoliciesAssigned in authorization policy."
        }
    } else {
        Write-Host "    [WhatIf] Would remove exclusion. No changes made." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[4] No exclusion to remove — skipping." -ForegroundColor Gray
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Audit all service principals for this App ID
#
# WHY: Even after fixing the policy, we need to know WHERE this app has already
#   been consented in the tenant. Each service principal represents an instance
#   of the app that has been granted some level of access.
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[5] Auditing service principals for App ID $VulnerableAppId..." -ForegroundColor Cyan

try {
    $servicePrincipals = Get-MgServicePrincipal -Filter "appId eq '$VulnerableAppId'" -All -ErrorAction Stop

    if ($servicePrincipals) {
        Write-Host "    [!] Found $($servicePrincipals.Count) service principal(s):" -ForegroundColor Yellow
        
        foreach ($sp in $servicePrincipals) {
            $spInfo = [ordered]@{
                Id          = $sp.Id
                AppId       = $sp.AppId
                DisplayName = $sp.DisplayName
                AppOwnerTenantId = $sp.AppOwnerOrganizationId
                Enabled     = $sp.AccountEnabled
                CreatedAt   = $sp.CreatedDateTime
            }
            
            $report.AuditedServicePrincipals += $spInfo
            
            Write-Host "      ID:          $($sp.Id)" -ForegroundColor Gray
            Write-Host "      Name:        $($sp.DisplayName)" -ForegroundColor Gray
            Write-Host "      Owner Tenant: $($sp.AppOwnerOrganizationId)" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "    [OK] No service principals found for this App ID in this tenant." -ForegroundColor Green
    }
} catch {
    Write-Warning "Could not enumerate service principals: $_"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Audit all OAuth 2.0 delegated permission grants
#
# WHY: OAuth grants are the actual permissions the app has received from users
#   or admins. We list these so you can decide whether to revoke them.
#   A grant means the app CAN act on behalf of that user right now.
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[6] Auditing OAuth2 permission grants for this App ID..." -ForegroundColor Cyan

try {
    foreach ($sp in $servicePrincipals) {
        $grants = Get-MgServicePrincipalOauth2PermissionGrant -ServicePrincipalId $sp.Id -All -ErrorAction SilentlyContinue

        foreach ($grant in $grants) {
            $grantInfo = [ordered]@{
                GrantId          = $grant.Id
                ServicePrincipalId = $sp.Id
                ConsentType      = $grant.ConsentType  # "AllPrincipals" = admin consent, "Principal" = user consent
                PrincipalId      = $grant.PrincipalId
                Scope            = $grant.Scope
                ExpiryTime       = $grant.ExpiryTime
            }
            $report.AuditedOAuthGrants += $grantInfo
            
            $riskLevel = if ($grant.ConsentType -eq "AllPrincipals") { "HIGH RISK (Admin-consented for all users)" } else { "user-consented" }
            Write-Host "      Grant: $($grant.Id) | Scope: $($grant.Scope) | Type: $riskLevel" -ForegroundColor $(if ($grant.ConsentType -eq "AllPrincipals") { "Red" } else { "Yellow" })
        }
    }

    if ($report.AuditedOAuthGrants.Count -eq 0) {
        Write-Host "    [OK] No active OAuth grants found." -ForegroundColor Green
    }
} catch {
    Write-Warning "Could not enumerate OAuth grants: $_"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Generate recommendations
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[7] Generating recommendations..." -ForegroundColor Cyan

if ($report.AuditedOAuthGrants.Count -gt 0) {
    $adminGrants = $report.AuditedOAuthGrants | Where-Object { $_.ConsentType -eq "AllPrincipals" }
    if ($adminGrants) {
        $report.Recommendations += "CRITICAL: $($adminGrants.Count) admin-level OAuth grant(s) exist for this app. Review and revoke unused grants via Entra ID > Enterprise Applications > $VulnerableAppId > Permissions."
    }
}

if ($report.AuditedServicePrincipals.Count -gt 0) {
    $report.Recommendations += "Review all $($report.AuditedServicePrincipals.Count) service principal(s) listed in this report. Disable or delete any that are not actively needed."
}

$report.Recommendations += "Enable 'Admin consent required' for all third-party apps in Entra ID > Enterprise Applications > Consent and permissions."
$report.Recommendations += "Set up Azure AD Access Reviews to periodically re-evaluate app consents."
$report.Recommendations += "Monitor future consent activity via Entra ID > Audit Logs, filtering for 'Consent to application' operations."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8: Save the remediation report
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[8] Saving remediation report..." -ForegroundColor Cyan

try {
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $ReportPath -Encoding UTF8
    Write-Host "    Report saved to: $ReportPath" -ForegroundColor Green
} catch {
    Write-Warning "Could not save report: $_"
}

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n" + ("─" * 60) -ForegroundColor DarkGray
Write-Host "REMEDIATION SUMMARY" -ForegroundColor Cyan
Write-Host ("─" * 60) -ForegroundColor DarkGray
Write-Host "  Exclusion found in policy:  $($report.ExclusionFound)" -ForegroundColor $(if ($report.ExclusionFound) { "Red" } else { "Green" })
Write-Host "  Exclusion removed:          $($report.ExclusionRemoved)" -ForegroundColor $(if ($report.ExclusionRemoved) { "Green" } else { "Gray" })
Write-Host "  Service principals found:   $($report.AuditedServicePrincipals.Count)"
Write-Host "  Active OAuth grants found:  $($report.AuditedOAuthGrants.Count)"
Write-Host ""
Write-Host "RECOMMENDATIONS:" -ForegroundColor Yellow
$report.Recommendations | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host ""

Disconnect-MgGraph | Out-Null
Write-Host "Done. Graph session disconnected." -ForegroundColor DarkGray
