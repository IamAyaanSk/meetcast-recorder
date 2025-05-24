interface ServerToRecorderEvents {
  startRecording: (params: { meetUrl: string }) => void
  stopRecording: () => void

  getRecorderStatus: () => void
}

interface RecorderToServerEvents {
  recorderStatus: (status: { isRecording: boolean }) => void
}

export type { ServerToRecorderEvents, RecorderToServerEvents }
