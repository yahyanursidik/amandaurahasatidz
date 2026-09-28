# Raster fallback for email clients which do not display SVG images.
# The transparent bitmap follows public/images/tarbiyah-sunnah-logo.svg.
Add-Type -AssemblyName System.Drawing

$outputPath = Join-Path $PSScriptRoot '..\public\images\tarbiyah-sunnah-logo.png'
$bitmap = New-Object System.Drawing.Bitmap(1200, 340)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::Transparent)

$gold = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#E9AB00'))
$orange = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#CF8119'))
$green = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#4E6940'))
$graphics.FillPolygon($gold, [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(124, 12), [System.Drawing.Point]::new(280, 255),
    [System.Drawing.Point]::new(124, 97)))
$graphics.FillPolygon($orange, [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(46, 47), [System.Drawing.Point]::new(284, 277),
    [System.Drawing.Point]::new(46, 157)))
$graphics.FillPolygon($green, [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new(24, 166), [System.Drawing.Point]::new(288, 305),
    [System.Drawing.Point]::new(24, 305)))

$font = New-Object System.Drawing.Font('Arial', 106, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('Tarbiyah', $font, $green, [System.Drawing.PointF]::new(321, 13))
$graphics.DrawString('Sunnah', $font, $green, [System.Drawing.PointF]::new(321, 145))
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$font.Dispose()
$gold.Dispose()
$orange.Dispose()
$green.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
