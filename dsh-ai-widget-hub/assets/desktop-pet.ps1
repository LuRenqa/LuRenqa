# DSH AI pet desktop helper - shipped with the plugin, no extra install.
param(
  [Parameter(Mandatory = $true)][string]$ConfigFile,
  [Parameter(Mandatory = $true)][string]$PosFile
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml, System.Windows.Forms, System.Drawing

$script:Pos = @{}
$script:Pets = @{}
$script:Players = New-Object System.Collections.ArrayList
$script:Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:ConfigMtime = [datetime]::MinValue
$script:App = New-Object System.Windows.Application
$script:App.ShutdownMode = [System.Windows.ShutdownMode]::OnExplicitShutdown

function Read-JsonFile([string]$path) {
  try {
    if (Test-Path -LiteralPath $path) {
      $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
      if ($raw) { return ($raw | ConvertFrom-Json) }
    }
  } catch {}
  return $null
}

function Save-Positions() {
  try {
    $out = @{}
    foreach ($k in $script:Pos.Keys) { $out[$k] = $script:Pos[$k] }
    ($out | ConvertTo-Json -Compress -Depth 4) | Set-Content -LiteralPath $PosFile -Encoding UTF8
  } catch {}
}

if (Test-Path -LiteralPath $PosFile) {
  $saved = Read-JsonFile $PosFile
  if ($saved) { foreach ($p in $saved.PSObject.Properties) { $script:Pos[$p.Name] = $p.Value } }
}

function New-Brush([string]$color, [double]$alpha = 1) {
  try {
    $c = [System.Windows.Media.ColorConverter]::ConvertFromString($color)
    $b = New-Object System.Windows.Media.SolidColorBrush($c)
    $b.Opacity = $alpha
    return $b
  } catch { return [System.Windows.Media.Brushes]::White }
}

function Play-Sound([string]$path) {
  try {
    if ([string]::IsNullOrWhiteSpace($path)) { return }
    if (-not (Test-Path -LiteralPath $path)) { return }
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Open((New-Object System.Uri($path)))
    $player.Volume = 0.85
    $player.Play()
    [void]$script:Players.Add($player)
    if ($script:Players.Count -gt 12) { $script:Players.RemoveAt(0) }
  } catch {}
}

function Bounce($st) {
  try {
    $a1 = New-Object System.Windows.Media.Animation.DoubleAnimation(1.0, 0.86, [System.Windows.Duration]::new([TimeSpan]::FromMilliseconds(90)))
    $a1.AutoReverse = $true
    $st.Scale.BeginAnimation([System.Windows.Media.ScaleTransform]::ScaleYProperty, $a1)
    $a2 = New-Object System.Windows.Media.Animation.DoubleAnimation(1.0, 0.95, [System.Windows.Duration]::new([TimeSpan]::FromMilliseconds(90)))
    $a2.AutoReverse = $true
    $st.Scale.BeginAnimation([System.Windows.Media.ScaleTransform]::ScaleXProperty, $a2)
  } catch {}
}

function Ensure-Session([string]$authUrl) {
  try {
    if ([string]::IsNullOrWhiteSpace($authUrl)) { return }
    Invoke-WebRequest -Uri $authUrl -WebSession $script:Session -UseBasicParsing -MaximumRedirection 6 -TimeoutSec 6 | Out-Null
  } catch {}
}

function Get-BalanceText($st) {
  $name = [string]$st.Cfg.name
  $url = [string]$st.Cfg.balanceUrl
  if ([string]::IsNullOrWhiteSpace($url)) { return "$name`n余额：—" }
  try {
    $resp = Invoke-WebRequest -Uri $url -WebSession $script:Session -UseBasicParsing -TimeoutSec 6
    $r = $resp.Content | ConvertFrom-Json
    if ($r -and $r.ok -eq $true -and $null -ne $r.totalBalance) {
      $cur = [string]$r.currency
      if ($cur -eq 'USD') { $sym = '$' } elseif ($cur -eq 'CNY' -or $cur -eq '') { $sym = '¥' } else { $sym = "$cur " }
      $val = [math]::Round([double]$r.totalBalance, 2)
      return "$name`n$sym$val"
    }
    return "$name`n余额获取失败"
  } catch {
    return "$name`n余额：—"
  }
}

function Show-Bubble($st) {
  try {
    if ($st.BubbleTimer) { $st.BubbleTimer.Stop() }
    $st.Text.Text = Get-BalanceText $st
    $st.Bubble.Visibility = [System.Windows.Visibility]::Visible
    $st.BubbleTimer = New-Object System.Windows.Threading.DispatcherTimer
    $st.BubbleTimer.Interval = [TimeSpan]::FromSeconds(5)
    $st.BubbleTimer.add_Tick({ try { $st.Bubble.Visibility = [System.Windows.Visibility]::Collapsed; $st.BubbleTimer.Stop() } catch {} }.GetNewClosure())
    $st.BubbleTimer.Start()
  } catch {}
}

function Set-PetImage($st, [string]$path) {
  try {
    if ([string]::IsNullOrWhiteSpace($path)) { return }
    $bmp = New-Object System.Windows.Media.Imaging.BitmapImage
    $bmp.BeginInit()
    $bmp.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $bmp.UriSource = New-Object System.Uri($path)
    $bmp.EndInit()
    $bmp.Freeze()
    $st.Img.Source = $bmp
    $st.Form2 = ($path -eq [string]$st.Cfg.img2)
  } catch {}
}

function Toggle-PetForm($st) {
  try {
    $target = if ($st.Form2) { [string]$st.Cfg.img1 } else { [string]$st.Cfg.img2 }
    Set-PetImage $st $target
    Bounce $st
  } catch {}
}

function Disable-Desktop($st) {
  $ok = $false
  try {
    $api = [string]$st.Cfg.apiUrl
    if (-not [string]::IsNullOrWhiteSpace($api)) {
      $body = (@{ id = [string]$st.Cfg.id; enabled = $false } | ConvertTo-Json -Compress)
      Invoke-WebRequest -Uri $api -Method POST -WebSession $script:Session -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 6 | Out-Null
      $ok = $true
    }
  } catch {}
  if ($ok) {
    try { $st.Win.Close() } catch {}
  } else {
    try { $st.Text.Text = '关闭桌面失败，请到 DSH 面板操作'; $st.Bubble.Visibility = [System.Windows.Visibility]::Visible } catch {}
  }
}

function New-Pet($cfg) {
  $id = [string]$cfg.id
  $size = 340.0
  try { if ($cfg.size) { $size = [double]$cfg.size } } catch {}
  $w = $size * 1.20
  $h = $size * 1.18

  $win = New-Object System.Windows.Window
  $win.WindowStyle = [System.Windows.WindowStyle]::None
  $win.AllowsTransparency = $true
  $win.Background = [System.Windows.Media.Brushes]::Transparent
  $win.Topmost = $true
  $win.ShowInTaskbar = $false
  $win.ShowActivated = $false
  $win.ResizeMode = [System.Windows.ResizeMode]::NoResize
  $win.Width = $w
  $win.Height = $h
  $win.Title = "AI娘-$([string]$cfg.name)"

  $grid = New-Object System.Windows.Controls.Grid
  $grid.Background = [System.Windows.Media.Brushes]::Transparent

  $img = New-Object System.Windows.Controls.Image
  $img.Width = $size
  $img.Height = $size
  $img.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
  $img.VerticalAlignment = [System.Windows.VerticalAlignment]::Bottom
  $img.Stretch = [System.Windows.Media.Stretch]::Uniform
  $img.RenderTransformOrigin = New-Object System.Windows.Point(0.5, 1.0)
  $scale = New-Object System.Windows.Media.ScaleTransform(1.0, 1.0)
  $img.RenderTransform = $scale
  $grid.Children.Add($img) | Out-Null

  $bubble = New-Object System.Windows.Controls.Border
  $bubble.CornerRadius = New-Object System.Windows.CornerRadius(14)
  $bubble.Background = New-Brush '#fffdf7' 0.97
  $bubble.BorderThickness = New-Object System.Windows.Thickness(2)
  $bubble.BorderBrush = New-Brush ([string]$cfg.accent) 1
  $bubble.Padding = New-Object System.Windows.Thickness(12, 8, 12, 8)
  $bubble.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
  $bubble.VerticalAlignment = [System.Windows.VerticalAlignment]::Bottom
  # 气泡贴着角色头顶（原来放在窗口左上角，离角色太远）
  $bubble.Margin = New-Object System.Windows.Thickness(0, 0, ($size * 0.05), ($size - 10))
  $bubble.MaxWidth = $size * 1.05
  $bubble.Visibility = [System.Windows.Visibility]::Collapsed
  $txt = New-Object System.Windows.Controls.TextBlock
  $txt.FontSize = 15
  $txt.FontWeight = [System.Windows.FontWeights]::SemiBold
  $txt.Foreground = New-Brush '#2a2140' 1
  $txt.Text = [string]$cfg.name
  $bubble.Child = $txt
  $grid.Children.Add($bubble) | Out-Null

  # 左上角常驻两个小按钮：切换状态1/2、关闭桌面显示
  $bar = New-Object System.Windows.Controls.StackPanel
  $bar.Orientation = [System.Windows.Controls.Orientation]::Horizontal
  $bar.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Left
  $bar.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
  $bar.Margin = New-Object System.Windows.Thickness(6, 6, 0, 0)
  $btnForm = New-Object System.Windows.Controls.Button
  $btnForm.Content = '切换形态'
  $btnForm.FontSize = 11
  $btnForm.Padding = New-Object System.Windows.Thickness(6, 2, 6, 2)
  $btnForm.Margin = New-Object System.Windows.Thickness(0, 0, 4, 0)
  $btnForm.Background = New-Brush ([string]$cfg.accent) 0.92
  $btnForm.Foreground = New-Brush '#ffffff' 1
  $btnForm.BorderThickness = New-Object System.Windows.Thickness(0)
  $btnForm.Tag = $st
  $btnForm.add_Click({ param($sender, $e) try { Toggle-PetForm $sender.Tag } catch {} })
  $bar.Children.Add($btnForm) | Out-Null
  $btnDesk = New-Object System.Windows.Controls.Button
  $btnDesk.Content = '关闭桌面'
  $btnDesk.FontSize = 11
  $btnDesk.Padding = New-Object System.Windows.Thickness(6, 2, 6, 2)
  $btnDesk.Background = New-Brush '#111827' 0.85
  $btnDesk.Foreground = New-Brush '#ffffff' 1
  $btnDesk.BorderThickness = New-Object System.Windows.Thickness(0)
  $btnDesk.Tag = $st
  $btnDesk.add_Click({ param($sender, $e) try { Disable-Desktop $sender.Tag } catch {} })
  $bar.Children.Add($btnDesk) | Out-Null
  $grid.Children.Add($bar) | Out-Null

  $win.Content = $grid

  $st = @{ Win = $win; Img = $img; Scale = $scale; Bubble = $bubble; Text = $txt; Cfg = $cfg; Size = $size; BubbleTimer = $null; Drag = $null; Moved = $false; Form2 = $false }
  $win.Tag = $st

  Set-PetImage $st ([string]$cfg.img1)

  $left = $null; $top = $null
  if ($script:Pos.ContainsKey($id)) {
    try { $left = [double]$script:Pos[$id][0]; $top = [double]$script:Pos[$id][1] } catch {}
  }
  if ($null -eq $left) {
    $sw = [System.Windows.SystemParameters]::PrimaryScreenWidth
    $sh = [System.Windows.SystemParameters]::PrimaryScreenHeight
    $left = [double]($sw - $w - 90)
    $top = [double]($sh - $h - 90 - ($script:Pets.Count * 40))
  }
  $win.Left = $left
  $win.Top = $top

  $win.Add_MouseLeftButtonDown({
    param($sender, $e)
    try {
      $s2 = $sender.Tag
      $p = $sender.PointToScreen($e.GetPosition($sender))
      $s2.Drag = @{ sx = $p.X; sy = $p.Y; wx = $sender.Left; wy = $sender.Top }
      $s2.Moved = $false
      [void]$sender.CaptureMouse()
      $e.Handled = $true
    } catch {}
  })

  $win.Add_MouseMove({
    param($sender, $e)
    try {
      $s2 = $sender.Tag
      if (-not $s2.Drag) { return }
      $p = $sender.PointToScreen($e.GetPosition($sender))
      # PointToScreen 是物理像素，Window.Left/Top 是 DIP：用 WPF 的 TransformFromDevice 做换算，
      # 否则 150% 缩放下桌宠会比鼠标快 1.5 倍。
      $dx = ($p.X - $s2.Drag.sx)
      $dy = ($p.Y - $s2.Drag.sy)
      try {
        $src = [System.Windows.PresentationSource]::FromVisual($sender)
        $m = $src.CompositionTarget.TransformFromDevice
        $dip = $m.Transform((New-Object System.Windows.Point($dx, $dy)))
        $dx = $dip.X
        $dy = $dip.Y
      } catch {}
      if ([math]::Abs($dx) + [math]::Abs($dy) -gt 5) { $s2.Moved = $true }
      if ($s2.Moved) { $sender.Left = $s2.Drag.wx + $dx; $sender.Top = $s2.Drag.wy + $dy }
    } catch {}
  })

  $win.Add_MouseLeftButtonUp({
    param($sender, $e)
    try {
      $s2 = $sender.Tag
      [void]$sender.ReleaseMouseCapture()
      if (-not $s2.Drag) { return }
      $moved = $s2.Moved
      $s2.Drag = $null
      if ($moved) {
        $script:Pos[[string]$s2.Cfg.id] = @([double]$sender.Left, [double]$sender.Top)
        Save-Positions
        return
      }
      Bounce $s2
      Play-Sound ([string]$s2.Cfg.sound1)
      Show-Bubble $s2
      $e.Handled = $true
    } catch {}
  })

  $menu = New-Object System.Windows.Controls.ContextMenu
  $miForm = New-Object System.Windows.Controls.MenuItem
  $miForm.Header = '切换形态'
  $miForm.Tag = $st
  $miForm.add_Click({
    param($sender, $e)
    try {
      $s2 = $sender.Tag
      $target = if ($s2.Form2) { [string]$s2.Cfg.img1 } else { [string]$s2.Cfg.img2 }
      Set-PetImage $s2 $target
      Bounce $s2
    } catch {}
  })
  [void]$menu.Items.Add($miForm)

  $miBig = New-Object System.Windows.Controls.MenuItem
  $miBig.Header = '放大'
  $miBig.Tag = $st
  $miBig.add_Click({ param($sender, $e) try { Resize-Pet $sender.Tag 1.12 } catch {} })
  [void]$menu.Items.Add($miBig)

  $miSmall = New-Object System.Windows.Controls.MenuItem
  $miSmall.Header = '缩小'
  $miSmall.Tag = $st
  $miSmall.add_Click({ param($sender, $e) try { Resize-Pet $sender.Tag 0.89 } catch {} })
  [void]$menu.Items.Add($miSmall)

  $miClose = New-Object System.Windows.Controls.MenuItem
  $miDesk = New-Object System.Windows.Controls.MenuItem
  $miDesk.Header = '关闭桌面显示'
  $miDesk.Tag = $st
  $miDesk.add_Click({ param($sender, $e) try { Disable-Desktop $sender.Tag } catch {} })
  [void]$menu.Items.Add($miDesk)

  $miClose.Header = '关闭窗口'
  $miClose.Tag = $st
  $miClose.add_Click({ param($sender, $e) try { $sender.Tag.Win.Close() } catch {} })
  [void]$menu.Items.Add($miClose)

  $grid.ContextMenu = $menu

  $script:Pets[$id] = $st
  $win.Add_Closed({ param($sender, $e) try { $script:Pets.Remove([string]$sender.Tag.Cfg.id) | Out-Null } catch {} })
  $win.Show()
  return $st
}

function Resize-Pet($st, [double]$factor) {
  if (-not $st) { return }
  $newSize = [math]::Max(120, [math]::Min(900, [double]$st.Size * $factor))
  $st.Size = $newSize
  $st.Img.Width = $newSize
  $st.Img.Height = $newSize
  $st.Win.Width = $newSize * 1.20
  $st.Win.Height = $newSize * 1.18
}

function Close-Pet([string]$id) {
  $st = $script:Pets[$id]
  if (-not $st) { return }
  try { $st.Win.Close() } catch {}
  $script:Pets.Remove($id) | Out-Null
}

function Sync-Config() {
  try {
    $info = Get-Item -LiteralPath $ConfigFile -ErrorAction SilentlyContinue
    if (-not $info) { return }
    if ($info.LastWriteTime -le $script:ConfigMtime) { return }
    $script:ConfigMtime = $info.LastWriteTime
    $cfg = Read-JsonFile $ConfigFile
    if (-not $cfg -or -not $cfg.pets) { return }

    if (-not [string]::IsNullOrWhiteSpace([string]$cfg.authUrl)) { Ensure-Session ([string]$cfg.authUrl) }

    $wanted = @{}
    foreach ($p in $cfg.pets) { $wanted[[string]$p.id] = $p }
    foreach ($id in @($script:Pets.Keys)) { if (-not $wanted.ContainsKey($id)) { Close-Pet $id } }
    foreach ($id in $wanted.Keys) {
      if ($script:Pets.ContainsKey($id)) { $script:Pets[$id].Cfg = $wanted[$id] }
      else { New-Pet $wanted[$id] | Out-Null }
    }
    $script:IdleStarted = [datetime]::Now
  } catch {}
}

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(1200)
$timer.add_Tick({ Sync-Config })
$timer.Start()

$script:IdleStarted = [datetime]::Now
$idleTimer = New-Object System.Windows.Threading.DispatcherTimer
$idleTimer.Interval = [TimeSpan]::FromSeconds(5)
$idleTimer.add_Tick({
  try {
    if ($script:Pets.Count -eq 0 -and ([datetime]::Now - $script:IdleStarted).TotalSeconds -gt 25) {
      $idleTimer.Stop()
      $script:App.Shutdown()
    }
  } catch {}
})
$idleTimer.Start()

Sync-Config
[void]$script:App.Run()
