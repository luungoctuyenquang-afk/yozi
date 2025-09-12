# Claude Code Dynamic StatusLine Script
# Reads JSON input from stdin and displays model name, directory, and time

# Set encoding to handle potential GBK/UTF-8 issues
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    # Read JSON input from stdin with proper encoding handling
    $inputLines = @()
    while ($null -ne ($line = [Console]::ReadLine())) {
        $inputLines += $line
    }
    
    $jsonInput = $inputLines -join "`n"
    
    if ([string]::IsNullOrEmpty($jsonInput.Trim())) {
        # Fallback when no JSON input
        $time = Get-Date -Format 'HH:mm'
        $currentDir = Split-Path -Leaf (Get-Location)
        Write-Output "o(*^w^*)o [Claude] ~~ [$currentDir] ~~ [$time]"
        exit 0
    }
    
    # Parse JSON
    $data = $jsonInput | ConvertFrom-Json
    
    # Extract model name - try multiple approaches
    $modelName = "Claude"
    if ($data.model) {
        if ($data.model.display_name) {
            $modelName = $data.model.display_name
        } elseif ($data.model.id) {
            # Convert model ID to friendly name
            $modelId = $data.model.id
            if ($modelId -match "sonnet") { $modelName = "Sonnet" }
            elseif ($modelId -match "opus") { $modelName = "Opus" }
            elseif ($modelId -match "haiku") { $modelName = "Haiku" }
            else { $modelName = $modelId }
        }
    }
    
    # Extract directory
    $directory = "yoyo"
    if ($data.workspace -and $data.workspace.current_dir) {
        $directory = Split-Path -Leaf $data.workspace.current_dir
    } elseif ($data.cwd) {
        $directory = Split-Path -Leaf $data.cwd
    }
    
    # Get current time
    $time = Get-Date -Format 'HH:mm'
    
    # Output the formatted statusline
    Write-Output "o(*^w^*)o [$modelName] ~~ [$directory] ~~ [$time]"
    
} catch {
    # Fallback on any error
    $time = Get-Date -Format 'HH:mm'
    $currentDir = Split-Path -Leaf (Get-Location)
    Write-Output "o(*^w^*)o [Claude] ~~ [$currentDir] ~~ [$time]"
}