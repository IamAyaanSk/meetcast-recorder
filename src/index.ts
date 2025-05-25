import dotenv from 'dotenv'
dotenv.config()

import { getStream, launch } from 'puppeteer-stream'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { Browser, Page } from 'puppeteer-core'
import Stream from 'stream'
import { CHROME_BIN, PORT, SOCKET_SERVER_URL } from '@/constants/global'
import { io, Socket } from 'socket.io-client'
import { ServerToRecorderEvents, RecorderToServerEvents } from '@/types/socket'

// hls output path
const hlsOutPath = path.resolve('./public/stream')

const socket: Socket<ServerToRecorderEvents, RecorderToServerEvents> = io(SOCKET_SERVER_URL, {
  extraHeaders: {
    authorization: `Bearer ${process.env.RECORDER_SPECIFIER_SECRET}`
  }
})

// recorder entities for cleanup
let browser: Browser | null = null
let stream: Stream.Transform | null = null
let ffmpeg: ChildProcessWithoutNullStreams | null = null
let page: Page | null = null

const app = express()

app.use(
  cors({
    origin: /^http:\/\/localhost(:[0-9]+)?$/,
    credentials: true
  })
)

// serving hls using express
app.use('/stream', express.static(path.join(__dirname, '../public/stream')))

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

// socket events
socket.on('connect', () => {
  console.log('Connected to socket server')
})

socket.on('startRecording', async ({ meetUrl }) => {
  console.log('Starting recording', meetUrl)
  if (stream || ffmpeg || page || browser) {
    console.log('Recording is already running, stopping it first')
    await stopRecording()
  }
  await startRecording({ meetUrl })
})

socket.on('stopRecording', async () => {
  console.log('Stopping recording')
  if (!stream || !ffmpeg || !page || !browser) {
    console.log('No recording is running')
    return
  }
  await stopRecording()
})

socket.on('getRecorderStatus', () => {
  console.log('Getting recorder status', !!stream)
  socket.emit('recorderStatus', {
    isRecording: !!stream
  })
})

socket.on('disconnect', async () => {
  console.log('Disconnected from socket server')
  // Cleanup if some recording is running
  if (stream || ffmpeg || page || browser) {
    console.log('Cleaning up resources')
    await stopRecording()
  }
})

async function startRecording({ meetUrl }: { meetUrl: string }) {
  try {
    if (!fs.existsSync(hlsOutPath)) {
      fs.mkdirSync(hlsOutPath, { recursive: true })
    }

    let hlsStreamAvailable = false

    browser = await launch({
      executablePath: CHROME_BIN,
      defaultViewport: {
        width: 1345,
        height: 810
      },
      args: ['--headless=chrome'],
      headless: true
    })

    page = await browser.newPage()
    await page.setViewport({
      width: 1345,
      height: 780
    })

    // add headers to page
    await page.setExtraHTTPHeaders({
      authorization: `Bearer ${process.env.CLIENT_SPECIFIER_SECRET}`,
      'x-meetcast-recorder-token': `Bearer ${process.env.RECORDER_AUTH_SECRET}`
    })

    await page.goto(meetUrl, {
      waitUntil: 'networkidle2'
    })

    stream = await getStream(page, { audio: true, video: true })

    ffmpeg = spawn('ffmpeg', [
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

    // ffmpeg.stderr.on('data', (data) => {
    //   console.error(`FFmpeg stderr: ${data}`)
    // })

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg exited with code ${code}`)
    })

    console.log('started Recording')

    // know that stream.m3u8 is ready
    ffmpeg.stderr.on('data', (data: Buffer) => {
      const output = data.toString()
      // console.log('FFmpeg output:', output)
      if (output.includes("Opening 'public/stream/stream.m3u8.tmp'") && !hlsStreamAvailable) {
        console.log('Recording started and stream.m3u8 is ready')

        socket.emit('recorderStatus', {
          isRecording: true
        })
        hlsStreamAvailable = true
      }
    })
  } catch (error) {
    console.error('Error starting recording:', error)
  }
}

async function stopRecording() {
  try {
    if (!stream || !ffmpeg || !page || !browser) {
      throw new Error('Recording is not running')
    }

    stream.destroy()
    ffmpeg.stdin.end()
    ffmpeg.stdin.destroy()
    ffmpeg.kill('SIGINT')
    console.log('stream destroyed')
    await page.close()
    console.log('page closed')

    await browser.close()
    console.log('recording stopped')

    // delete entire stream folder
    fs.rm(hlsOutPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error deleting stream folder:', err)
      }
      console.log('Stream folder deleted')
    })

    stream = null
    ffmpeg = null
    page = null
    browser = null
  } catch (error) {
    console.error('Error stopping recording:', error)
  }
}
