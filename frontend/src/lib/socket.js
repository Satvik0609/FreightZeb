import { io } from "socket.io-client";
import { API_URL } from "./utils";

let socket;

export function getSocket(token) {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      auth: { token },
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  socket.auth = { token };
  return socket;
}
