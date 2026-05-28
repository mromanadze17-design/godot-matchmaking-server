const WebSocket = require("ws");
const http      = require("http");

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Matchmaking server is running.");
});

const wss = new WebSocket.Server({ server });

let waiting  = null;
let hostConn = null;  // host WebSocket
let cliConn  = null;  // client WebSocket

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.on("close", () => {
    console.log("Player disconnected");
    if (waiting === ws) waiting = null;
    if (hostConn === ws) hostConn = null;
    if (cliConn  === ws) cliConn  = null;
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      // ── MATCHMAKING ──────────────────────────────────────
      if (msg.type === "search") {
        if (waiting && waiting.readyState === WebSocket.OPEN) {
          hostConn = waiting;
          cliConn  = ws;
          waiting  = null;
          hostConn.send(JSON.stringify({ type: "matched", role: "host" }));
          cliConn.send(JSON.stringify({ type: "matched", role: "client" }));
          console.log("Match found!");
        } else {
          waiting = ws;
          ws.send(JSON.stringify({ type: "waiting" }));
          console.log("Waiting for partner...");
        }
      }

      // ── SYNC JOIN — re-register after scene change ───────
      if (msg.type === "sync_join") {
        if (msg.role === "host") hostConn = ws;
        if (msg.role === "client") cliConn = ws;
        console.log("Sync joined as: " + msg.role);
      }

      // ── POSITION RELAY ───────────────────────────────────
      if (msg.type === "pos") {
        // Relay to the OTHER player only
        if (msg.role === "host" && cliConn && cliConn.readyState === WebSocket.OPEN) {
          cliConn.send(JSON.stringify(msg));
        } else if (msg.role === "client" && hostConn && hostConn.readyState === WebSocket.OPEN) {
          hostConn.send(JSON.stringify(msg));
        }
      }

      // ── CANCEL ───────────────────────────────────────────
      if (msg.type === "cancel") {
        if (waiting === ws) waiting = null;
        ws.send(JSON.stringify({ type: "cancelled" }));
      }

    } catch (e) {
      console.error("Bad message:", e);
    }
  });
});

// Keep alive
setInterval(() => {
  console.log("Server alive - " + new Date().toISOString());
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.ping();
  });
}, 600000);

server.listen(PORT, () => {
  console.log("Matchmaking server running on port " + PORT);
});
