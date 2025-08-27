// src/config/websocketUrls.js

const WS_ENV = {
  LOCAL: 'ws://localhost:8765',
  LOCAL_IP: 'ws://161.97.156.125:8765',
  NGROK: 'wss://websocket.dstrbtd.ai',
};

const CURRENT_WS_URL = WS_ENV.NGROK;

export default {
  WS_URL: CURRENT_WS_URL,
  WS_ENV,
};
