import ytdl from 'ytdl-core'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)

app.use(cors())

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

const port = process.env.PORT || 5000

var clientGlob

const getAudio = async (videoURL, res) => {
  try {
    const info = await ytdl.getInfo(videoURL)

    if (!info) {
      console.log('no info')

      throw {
        message: 'An error occurred',
      }
    }

    if (!clientGlob) {
      console.log('no clientGlob')
      throw {
        message: 'Worker not initialized',
      }
    }
    clientGlob.emit('videoDetails', [
      info.videoDetails.title,
      info.videoDetails.author.name,
    ])

    const res = await ytdl(videoURL, {
      quality: 'highestaudio',
      filter: 'audioonly',
    })
      .on('progress', (chunkSize, downloadedChunk, totalChunk) => {
        const progressPercentage = (downloadedChunk * 100) / totalChunk
        clientGlob.emit('progressEventSocket', [progressPercentage])
        clientGlob.emit('downloadCompletedServer', [downloadedChunk])
      })
      .pipe(res)

    console.log('🚀 ~ getAudio ~ res:', res)
    return {
      ...info,
      status: 200,
    }
  } catch (error) {
    console.log('🚀 ~ getAudio ~ error:', error)
    return {
      error: error.message,
      msg: 'an error occured',
      status: 400,
    }
  }
}

app.use(express.json()) // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })) // to support URL-encoded bodies
app.use(cors())

//root handler that sends the parameters to getAudio function
app.post('/', async (req, res) => {
  const audioData = await getAudio(req.body.url, res)

  if (audioData?.status === 400) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(audioData))
  }
})

//socket.io connection
io.on('connection', (client) => {
  clientGlob = client
  console.log('User connected')
})

httpServer.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
