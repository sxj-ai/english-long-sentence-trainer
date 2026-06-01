param(
  [string]$Repo = "sxj-ai/english-long-sentence-trainer",
  [string]$DefaultEnvId = "english-trainer-d0fj3e2879d038fe"
)

$ErrorActionPreference = "Stop"

function Get-GitHubCliPath {
  $command = Get-Command gh -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $defaultPath = "C:\Program Files\GitHub CLI\gh.exe"
  if (Test-Path $defaultPath) {
    return $defaultPath
  }

  throw "GitHub CLI was not found. Install it with: winget install --id GitHub.cli -e"
}

function Convert-SecureStringToPlainText {
  param([securestring]$Value)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Set-GitHubSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name cannot be empty."
  }

  $Value | & $script:GhPath secret set $Name --repo $Repo
}

$script:GhPath = Get-GitHubCliPath

Write-Host "Using GitHub CLI: $script:GhPath"
Write-Host "Target repository: $Repo"

& $script:GhPath auth status --hostname github.com 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "GitHub CLI is not logged in. Starting browser login..."
  & $script:GhPath auth login --hostname github.com --git-protocol https --web --scopes repo
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub login failed."
  }
}

$envIdInput = Read-Host "TCB_ENV_ID [$DefaultEnvId]"
$tcbEnvId = if ([string]::IsNullOrWhiteSpace($envIdInput)) { $DefaultEnvId } else { $envIdInput.Trim() }

$secretId = Convert-SecureStringToPlainText (Read-Host "TENCENTCLOUD_SECRET_ID" -AsSecureString)
$secretKey = Convert-SecureStringToPlainText (Read-Host "TENCENTCLOUD_SECRET_KEY" -AsSecureString)

Set-GitHubSecret -Name "TCB_ENV_ID" -Value $tcbEnvId
Set-GitHubSecret -Name "TENCENTCLOUD_SECRET_ID" -Value $secretId
Set-GitHubSecret -Name "TENCENTCLOUD_SECRET_KEY" -Value $secretKey

Write-Host "CloudBase GitHub Secrets have been saved to $Repo."
Write-Host "Next: GitHub -> Actions -> Deploy to CloudBase Run -> Run workflow."
