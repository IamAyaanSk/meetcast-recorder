import { getChromeBinPath } from '@/utils/puppeteer'

export const CHROME_BIN = process.env.CHROME_BIN ?? getChromeBinPath()
export const PORT = process.env.PORT ?? 8080
export const SOCKET_SERVER_URL = process.env.SOCKET_URL ?? 'http://localhost:4000'
