# Encodes the 1:16 product box videos (raw .MOV, 1080x1920 portrait via -90 rot)
# into fast-loading, web-ready portrait MP4 + a poster JPG, named by product slug.
# Raw MOVs stay in public/store16-images/video/ (gitignored); web files land in
# public/store16-video/ and ARE committed.
$ErrorActionPreference = "Stop"
$root = "C:\Users\H\Documents\GitHub\bch-rc"
$src  = Join-Path $root "public\store16-images\video"
$out  = Join-Path $root "public\store16-video"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# raw filename -> product slug
$map = @{
  "red.MOV"    = "drift-inferno"
  "toxic.MOV"  = "drift-toxic"
  "phatom.MOV" = "drift-phantom"
  "carbon.MOV" = "drift-carbon"
  "azure.MOV"  = "dares-azure"
}

foreach ($file in $map.Keys) {
  $in   = Join-Path $src $file
  $slug = $map[$file]
  $mp4  = Join-Path $out "$slug.mp4"
  $jpg  = Join-Path $out "$slug.jpg"
  if (-not (Test-Path $in)) { Write-Host "MISSING $in"; continue }

  Write-Host "Encoding $file -> $slug.mp4"
  # -noautorotate keeps the native 1920x1080 LANDSCAPE frame (the -90 tag would
  # otherwise rotate the box sideways into portrait). Scale to 1280x720.
  & ffmpeg -y -hide_banner -loglevel error -noautorotate -i $in `
    -vf "scale=1280:-2" -metadata:s:v:0 rotate=0 `
    -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 26 -preset veryfast `
    -movflags +faststart -c:a aac -b:a 96k $mp4

  Write-Host "Poster   $file -> $slug.jpg"
  & ffmpeg -y -hide_banner -loglevel error -noautorotate -ss 1.0 -i $in `
    -vf "scale=1280:-2" -frames:v 1 -q:v 4 $jpg
}

Write-Host "---- output ----"
Get-ChildItem $out -File | ForEach-Object { "{0,-26} {1,7:N0} KB" -f $_.Name, ($_.Length/1KB) }
