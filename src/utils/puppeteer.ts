import child_process from 'child_process'

// I took this util function directly from puppeteer-stream official example
// We need to set CHROME_BIN env variable ( for the spinned up docker container maybe ) to work smoothly for deployment
export const getChromeBinPath = () => {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN
  }

  let executablePath
  if (process.platform === 'linux') {
    try {
      executablePath = child_process.execSync('which chromium-browser').toString().split('\n').shift()
    } catch (e) {
      console.error('chromium-browser not found')
    }

    if (!executablePath) {
      executablePath = child_process.execSync('which chromium').toString().split('\n').shift()
      if (!executablePath) {
        throw new Error('Chromium not found (which chromium)')
      }
    }
  } else if (process.platform === 'darwin') {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'win32') {
    executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  } else {
    throw new Error('Unsupported platform: ' + process.platform)
  }

  return executablePath
}
