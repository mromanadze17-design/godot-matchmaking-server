const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let waiting = null; // holds one waiting player

wss.on("connection", (ws) => {
  console.log("Player connected");

  ws.on("close", () => {
    console.log("Player disconnected");
    if (waiting === ws) {
      waiting = null;
    }
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    if (msg.type === "search") {
      if (waiting && waiting.readyState === WebSocket.OPEN) {
        // Pair the two players
        const host   = waiting;
        const client = ws;
        waiting = null;

        // Tell host they are host
        host.send(JSON.stringify({ type: "matched", role: "host" }));
        // Tell client they are client
        client.send(JSON.stringify({ type: "matched", role: "client" }));

        console.log("Match found! Pairing two players.");
      } else {
        // No one waiting — this player waits
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
  });
});

console.log("Matchmaking server running on port " + PORT);
