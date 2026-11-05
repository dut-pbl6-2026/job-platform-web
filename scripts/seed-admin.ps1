param(
  [string]$AuthBase = "http://localhost:5001",
  [string]$Password = "Admin12345"
)

$ErrorActionPreference = "Stop"
$created = $null
for ($n = 1; $n -le 20; $n++) {
  $user = if ($n -eq 1) { "admin" } else { "admin$n" }
  $email = "$user@jobplatform.local"
  $body = @{ email = $email; password = $Password; fullName = "Admin"; role = "Admin" } | ConvertTo-Json
  try {
    $r = Invoke-WebRequest -Uri "$AuthBase/api/auth/register" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 15
    $json = $r.Content | ConvertFrom-Json
    Write-Host ("[OK] seeded Admin {0} role={1} id={2}" -f $json.email, $json.role, $json.userId)
    $created = $json
    break
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 409) {
      Write-Host "taken $email"
      continue
    }
    Write-Host ("[WARN] seed admin failed for {0}: {1}" -f $email, $_.Exception.Message)
    exit 0
  }
}
if (-not $created) {
  Write-Host "[WARN] admin, admin2, ... already registered — login with an existing Admin email"
}
Write-Host "login: use the email printed above / $Password"
