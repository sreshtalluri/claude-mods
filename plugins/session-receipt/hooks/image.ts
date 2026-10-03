/**
 * The commands that turn a receipt SVG into a PNG and put it on the clipboard,
 * per OS, using what the machine already has: Quick Look, a Chromium browser
 * (Edge ships with Windows) or rsvg-convert to draw it, the OS's own clipboard
 * command to copy it. Pure: register.tsx runs them, first success wins.
 */
export type Platform = 'mac' | 'windows' | 'linux'

/** Windows' folders, from its environment; ignored elsewhere. */
export type WindowsDirs = { programFiles: string; programFilesX86: string; localAppData: string }

export const SIZE = 1200

export const drawCommands = (os: Platform, svg: string, png: string, dir: string, win?: WindowsDirs): string[][] => {
  const url = 'file:///' + svg.replace(/\\/g, '/').replace(/^\/+/, '')
  const shot = (browser: string) => [browser, '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${SIZE},${SIZE}`, '--force-device-scale-factor=1', `--screenshot=${png}`, url]
  if (os === 'windows') {
    const w = win ?? { programFiles: 'C:\\Program Files', programFilesX86: 'C:\\Program Files (x86)', localAppData: '' }
    return [
      `${w.programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${w.programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${w.programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${w.localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
    ].map(shot)
  }
  if (os === 'mac') {
    return [
      // Quick Look names its output <svg>.png, which is `png`.
      ['qlmanage', '-t', '-s', String(SIZE), '-o', dir, svg],
      shot('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      shot('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
    ]
  }
  return [
    ...['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'].map(shot),
    ['rsvg-convert', '-w', String(SIZE), '-h', String(SIZE), '-o', png, svg],
  ]
}

export const clipboardCommand = (os: Platform, png: string): string[] =>
  os === 'windows'
    ? ['powershell', '-NoProfile', '-STA', '-Command',
        'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' +
        `[System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${png.replace(/'/g, "''")}'))`]
    : os === 'mac'
      ? ['osascript', '-e', `set the clipboard to (read (POSIX file "${png.replace(/["\\]/g, '\\$&')}") as «class PNGf»)`]
      : // Both fork a server for the clipboard: send its output away so the call returns.
        ['sh', '-c', 'wl-copy --type image/png < "$1" >/dev/null 2>&1 || xclip -selection clipboard -t image/png -i "$1" >/dev/null 2>&1', 'sh', png]
