// TLS SMTP sink for fictitious test mail only. No delivery to external addresses.
const tls = require("node:tls");
const fs = require("node:fs");
const server = tls.createServer(
  {
    key: fs.readFileSync("/smtp/key.pem"),
    cert: fs.readFileSync("/smtp/cert.pem"),
  },
  (socket) => {
    let pending = "",
      data = false,
      message = "";
    socket.setTimeout(30000, () => socket.destroy());
    socket.on("error", () => {});
    socket.write("220 smtp-test ESMTP\r\n");
    socket.on("data", (chunk) => {
      pending += chunk.toString();
      if (pending.length > 2 * 1024 * 1024) {
        socket.destroy();
        return;
      }
      let index;
      while ((index = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 2);
        if (data) {
          if (line === ".") {
            fs.writeFileSync("/smtp/message.eml", message, { mode: 0o600 });
            data = false;
            message = "";
            socket.write("250 Accepted\r\n");
          } else {
            message += line.replace(/^\.\./, ".") + "\r\n";
            if (message.length > 2 * 1024 * 1024) socket.destroy();
          }
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO"))
          socket.write("250-smtp-test\r\n250 SIZE 2097152\r\n");
        else if (cmd === "DATA") {
          data = true;
          socket.write("354 End with a dot\r\n");
        } else if (cmd === "QUIT") {
          socket.end("221 Bye\r\n");
        } else if (
          cmd.startsWith("MAIL FROM:") ||
          cmd.startsWith("RCPT TO:") ||
          cmd === "RSET" ||
          cmd === "NOOP"
        )
          socket.write("250 OK\r\n");
        else socket.write("502 Not implemented\r\n");
      }
    });
  },
);
server.listen(465, "0.0.0.0");
