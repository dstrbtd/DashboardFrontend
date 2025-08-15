// src/config/websocketUrls.js

const WS_ENV = {
  LOCAL: 'ws://localhost:8765',
  LOCAL_IP: 'ws://192.168.100.23:8765',
  NGROK: 'wss://2d145a260903.ngrok-free.app'
};

const CURRENT_WS_URL = WS_ENV.NGROK;

export default {
  WS_URL: CURRENT_WS_URL,
  WS_ENV,
};
