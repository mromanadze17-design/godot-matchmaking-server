const WebSocket = require("ws");
const http      = require("http");

const PORT = process.env.PORT || 8080;

// ── HTTP server for health check (keeps Render awake) ──────
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Matchmaking server is running.");
});

const wss = new WebSocket.Server({ server });

let waiting = null;

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.on("close", () => {
    console.log("Player disconnected");
    if (waiting === ws) {
      waiting = null;
    }
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "search") {
        if (waiting && waiting.readyState === WebSocket.OPEN) {
          const host   = waiting;
          const client = ws;
          waiting = null;
          host.send(JSON.stringify({ type: "matched", role: "host" }));
          client.send(JSON.stringify({ type: "matched", role: "client" }));
          console.log("Match found! Pairing two players.");
        } else {
          waiting = ws;
          ws.send(JSON.stringify({ type: "waiting" }));
          console.log("Player is waiting for partner...");
        }
      }

      if (msg.type === "cancel") {
        if (waiting === ws) {
          waiting = null;
        }
        ws.send(JSON.stringify({ type: "cancelled" }));
      }

    } catch (e) {
      console.error("Bad message:", e);
    }
  });
});

// ── Keep-alive ping every 10 minutes ───────────────────────
setInterval(() => {
  console.log("Server alive - " + new Date().toISOString());
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 600000);

server.listen(PORT, () => {
  console.log("Matchmaking server running on port " + PORT);
});
