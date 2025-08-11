// src/config/websocketUrls.js

const WS_ENV = {
  LOCAL: 'ws://localhost:8765',
  LOCAL_IP: 'ws://192.168.100.23:8765',
  NGROK: 'wss://aff1fda3ce35.ngrok-free.app',
};

const CURRENT_WS_URL = WS_ENV.LOCAL;

export default {
  WS_URL: CURRENT_WS_URL,
  WS_ENV,
};
