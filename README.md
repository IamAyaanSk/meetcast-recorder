## MeetCast recorder 

MeetCast recorder is the recorder server which is responsible to record the ongoing call, obtain the streams and pipe it to ffmpeg to generate the hls streams. This stream is then served 
to the client over express server. It creates a socket connection with the SFU server and starts recording, stops recording ( perform cleanups ), send recorder status. 

### Features 
- Records and stops recording a call dynamically.
- Performs cleanup so that new call can be recorded and streamed smoothly.
- Creates and serves the hls stream over the express endpoint.
- Records the call by joining in as a special user ( recorder mode ) which don't create any producers or disturbs the original connected client count.

### Tech stack 
- Nodejs
- Typescript
- Socket.io client
- Puppeteer 
- FFMPEG
- Express

### Installation 

1. Clone this repository.
2. Install FFMPEG ( important ).
3. Install dependencies
   ```bash
   pnpm install
   ```
5. Set env variables
   Refer the `.env.example` file for setup.
6. Configure the client and SFU server too ( check readme for specific repositories for more information )
7. To start the serrver in dev mode
   ```bash
   pnpm dev
   ```
9. To start in prod mode
    ```bash
   pnpm build && pnpm start
    ```

## Author 
### Ayaan Shaikh
