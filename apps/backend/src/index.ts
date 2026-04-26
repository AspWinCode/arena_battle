import 'dotenv/config'
import { buildServer } from './server.js'

const server = await buildServer()

try {
  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '0.0.0.0',
  })
  console.log(`🚀 RoboCode Arena backend listening on port ${process.env.PORT ?? 3001}`)
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
