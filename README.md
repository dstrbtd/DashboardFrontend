<div align="center">

# **Dashboard Frontend** <!-- omit in toc -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) 

</div>

<div align="center">
  <img src="public/dasboard%20screenshot.png" alt="Dashboard Screenshot" width="800"/>
</div>


---

# Overview
This repository contains the frontend and WebSocket server setup for visualizing live dashboard data from InfluxDB.  
It supports local development, secure deployment via Vercel, and HTTPS WebSocket tunneling with ngrok.

---

# Minimum Requirements
- Node.js and npm installed
- Python 3.10+
- `tmux` for running background processes
- [ngrok](https://ngrok.com/) account for secure WebSocket tunneling
- Vercel account for deployment

---

# Installation & Local Setup

1. **Clone the repository**
```bash
git clone https://github.com/dstrbtd/DashboardFrontend/
cd DashboardFrontend
```

3. **Create Python virtual environment**
```bash
python3 -m venv .venv
```

2. **Install Python dependencies**
```bash
pip install websockets pandas influxdb-client
```

3. **Install Node dependencies**
```bash
npm install
```

4. **Run the WebSocket server**
```bash
tmux new -s ws_server
python data/websocket_server.py
# Press Ctrl+b, then d to detach
```

5. **Install npm**
```bash
apt update && apt-get update && apt install npm
```

6. **Install npm**
```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```

7. **Test the webpage locally**
```bash
npm run dev  # Runs on http://localhost:5173/
```

> Tip:
> To see live data locally, temporarily set CURRENT_WS_URL in
> websocketUrls.js to LOCAL. Don’t forget to switch it back to NGROK before publishing.

# Publishing the Webpage
**Deploy with Vercel**
1. Go to vercel.com
2. Connect your GitHub account
3. Import the DashboardFrontend repository
4. Vercel will auto-deploy after each push.
5. Add a custom domain: dash.dstrbtd.ai and configure your DNS provider with a CNAME record pointing to Vercel.


**Set Up HTTPS WebSocket Tunneling**
Vercel only accepts data via HTTPS.
On the same machine running the WebSocket server:

```bash
tmux new -s ngrok_ws
ngrok http 8765
```

Copy the new ngrok URL and update websocketUrls.js:

```javascript
NGROK: 'wss://<your_ngrok_subdomain>.ngrok-free.app'
```


# Verification
After deployment and ngrok setup:
- Visit https://dash.dstrbtd.ai
- Confirm that live data is flowing from the WebSocket server

**License**
```text
The MIT License (MIT)
Copyright © 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the “Software”), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```