# Debug version to log JSON input
$logFile = "E:\柚子机\yoyo\.claude\statusline-debug.log"

# Read input
$input = [Console]::In.ReadToEnd()

# Log the raw input
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')]" | Out-File $logFile -Append
"Raw Input:" | Out-File $logFile -Append
$input | Out-File $logFile -Append
"---" | Out-File $logFile -Append

# Try to parse and display
try {
    $json = $input | ConvertFrom-Json
    $time = Get-Date -Format 'HH:mm'
    
    # Log parsed data
    "Model: $($json.model)" | Out-File $logFile -Append
    "Model.display_name: $($json.model.display_name)" | Out-File $logFile -Append
    "Model.id: $($json.model.id)" | Out-File $logFile -Append
    "===" | Out-File $logFile -Append
    
    # Extract model name
    $model = "Claude"
    if ($json.model.display_name) {
        $model = $json.model.display_name
    } elseif ($json.model.id) {
        if ($json.model.id -match "opus") { $model = "Opus" }
        elseif ($json.model.id -match "sonnet") { $model = "Sonnet" }
        else { $model = $json.model.id }
    }
    
    $dir = if ($json.workspace.current_dir) { Split-Path -Leaf $json.workspace.current_dir } else { "yoyo" }
    
    Write-Output "o(*^w^*)o [$model] ~~ [$dir] ~~ [$time]"
} catch {
    Write-Output "o(*^w^*)o [Error] ~~ [Debug] ~~ [$(Get-Date -Format 'HH:mm')]"
}