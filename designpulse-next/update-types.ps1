Param(
    [string]$DbUrl
)

if ($DbUrl) {
    Write-Host "Generating types using database URL..." -ForegroundColor Cyan
    npx supabase gen types typescript --db-url $DbUrl > src/types/database.types.ts
} else {
    Write-Host "Generating types using project ID (yrfzwtemupbesyunggcm)..." -ForegroundColor Cyan
    npx supabase gen types typescript --project-id yrfzwtemupbesyunggcm > src/types/database.types.ts
}
Write-Host "Types generated successfully!" -ForegroundColor Green
