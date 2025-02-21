/**
 * Minimal API server
 * @see https://bun.sh/docs/api/http
 */
let lastReceivedMessage: any

export function getLastReceivedMessage() {
  return lastReceivedMessage
}

export async function startServer() {
  const server = Bun.serve({
    port: 3333,
    async fetch(req: Request) {
      const method = req.method.toUpperCase()
      const ip = server.requestIP(req)?.address

      console.log(method, req.url, 'from', ip)

      lastReceivedMessage = null

      if (method === 'POST') {
        let message
        try {
          message = await req.json()
          console.log('Test server received message', message)
        } catch (e) {
          console.log('Bad request')
          console.log(await req.text())
          console.log(e)
          return new Response('Bad request', { status: 400 })
        }

        lastReceivedMessage = message

        if (message.type === 'git' && message.event === 'tag' && message.tag) {
          console.log('Git tag', message.tag)
        }
      }

      return new Response('OK')
    },
  })

  return server
}
