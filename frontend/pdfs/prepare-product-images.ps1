param([string]$SourceBolos,[string]$SourceDoces,[string]$Destination)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

function Export-SquareImage([string]$InputFile,[string]$OutputFile) {
  $source = [System.Drawing.Image]::FromFile($InputFile)
  try {
    $side = [Math]::Min($source.Width, $source.Height)
    $left = [Math]::Floor(($source.Width - $side) / 2)
    $top = [Math]::Floor(($source.Height - $side) / 2)
    $canvas = New-Object System.Drawing.Bitmap 640,640
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source,[System.Drawing.Rectangle]::new(0,0,640,640),[System.Drawing.Rectangle]::new($left,$top,$side,$side),[System.Drawing.GraphicsUnit]::Pixel)
      } finally { $graphics.Dispose() }
      $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),82L
      $canvas.Save($OutputFile,$encoder,$parameters)
    } finally { $canvas.Dispose() }
  } finally { $source.Dispose() }
}

Get-ChildItem -LiteralPath $SourceBolos -Filter '*.jpg' | Sort-Object Name | ForEach-Object {
  Export-SquareImage $_.FullName (Join-Path $Destination ('bolo-' + $_.Name))
}
Get-ChildItem -LiteralPath $SourceDoces -Filter '*.jpg' | Sort-Object Name | ForEach-Object {
  Export-SquareImage $_.FullName (Join-Path $Destination ('doce-' + $_.Name))
}
