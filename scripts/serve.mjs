import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"],
]);

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let filePath = path.resolve(root, `.${urlPath}`);
    if (!filePath.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mime.get(path.extname(filePath)) || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`ShelfGuard: http://127.0.0.1:${port}`));
