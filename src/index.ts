import dotenv from 'dotenv'
dotenv.config()

import { getStream, launch } from 'puppeteer-stream'
import { getExecutablePath } from '@/utils/puppeteer'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'

const chromePath = getExecutablePath()
const meetUrl = process.env.MEET_URL

const app = express()

app.use(
  cors({
    origin: '*',
    credentials: true
  })
)

app.use('/stream', express.static(path.join(__dirname, '../public/stream')))

app.listen(8080, () => {
  console.log('Server is running on http://localhost:8080')
})

async function startRecording() {
  try {
    if (!meetUrl) {
      throw new Error('Meet url not found')
    }

    const outputDir = path.resolve('./public/stream')

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const browser = await launch({
      executablePath: chromePath,
      defaultViewport: {
        width: 1345,
        height: 810
      },
      args: ['--headless=chrome'],
      headless: true
    })

    const context = browser.defaultBrowserContext()
    // TODO: Remove this when integrated at server and client
    await context.overridePermissions(meetUrl, ['camera', 'microphone'])

    const page = await browser.newPage()
    await page.setViewport({
      width: 1345,
      height: 780
    })

    await page.goto(meetUrl, {
      waitUntil: 'networkidle2'
    })

    const stream = await getStream(page, { audio: true, video: true })

    const ffmpeg = spawn('ffmpeg', [
      '-i',
      'pipe:0',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-g',
      '120',
      '-sc_threshold',
      '0',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-f',
      'hls',
      '-hls_time',
      '4',
      '-hls_list_size',
      '0',
      '-hls_flags',
      'program_date_time+append_list+split_by_time',
      '-hls_segment_type',
      'fmp4',
      '-hls_fmp4_init_filename',
      'init.mp4',
      '-hls_segment_filename',
      'public/stream/segment_%05d.m4s',
      'public/stream/stream.m3u8'
    ])

    stream.pipe(ffmpeg.stdin)

    ffmpeg.stderr.on('data', (data) => {
      console.error(`FFmpeg stderr: ${data}`)
    })

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg exited with code ${code}`)
    })

    console.log('recording')

    await new Promise((resolve) => setTimeout(resolve, 600000))

    stream.destroy()
    ffmpeg.stdin.end()
    ffmpeg.stdin.destroy()
    ffmpeg.kill('SIGINT')
    console.log('stream destroyed')
    await page.close()
    console.log('page closed')

    await browser.close()
    console.log('recording stopped')

    console.log('file closed')
  } catch (error) {
    console.error('Error starting recording:', error)
  }
}

startRecording().catch((error) => {
  console.error('Error in startRecording:', error)
})

// TODO:
// connect to socket server
// implement start/stop recording via events dynamically
