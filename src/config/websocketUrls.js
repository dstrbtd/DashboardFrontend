// src/config/websocketUrls.js

const WS_ENV = {
  LOCAL: 'ws://localhost:8765',
  LOCAL_IP: 'ws://161.97.156.125:8765',
  NGROK: 'wss://websocket.dstrbtd.ai',
};

const API_ENV = {
  MECH1_LOCAL: 'http://localhost:22557',
  MECH1_PROD: import.meta.env.VITE_MECH1_API_URL || 'http://localhost:22557',
};

const CURRENT_WS_URL = WS_ENV.NGROK;

export default {
  WS_URL: CURRENT_WS_URL,
  WS_ENV,
  API_ENV,
  MECH1_API_URL: API_ENV.MECH1_PROD,
};
