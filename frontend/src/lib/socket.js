import { io } from 'socket.io-client'

let socket = null

export function getSocket(token) {
  if (!socket) {
    socket = io('http://localhost:5000', {
      auth: { token },
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
