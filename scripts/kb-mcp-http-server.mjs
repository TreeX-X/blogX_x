#!/usr/bin/env node
import http from "http";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = process.env.BLOGX_KB_ROOT
  ? path.resolve(process.env.BLOGX_KB_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number.parseInt(process.env.BLOGX_KB_HTTP_PORT || "8787", 10);
const HOST = process.env.BLOGX_KB_HTTP_HOST || "127.0.0.1";
const SERVER_ENTRY = path.join(ROOT, "scripts", "kb-mcp-server.mjs");

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body.length ? JSON.parse(body) : null);
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function runStdioRequest(message) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: ROOT,
      env: {
        ...process.env,
        BLOGX_KB_ROOT: ROOT,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const request = JSON.stringify(message);
    const framed = `Content-Length: ${Buffer.byteLength(request, "utf8")}\r\n\r\n${request}`;
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBuffer = Buffer.alloc(0);
    let expectedLength = null;
    let settled = false;
    const isNotification = !Object.prototype.hasOwnProperty.call(message ?? {}, "id");

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error("MCP request timed out"));
    }, 15000);

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.stdout.on("data", (chunk) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);

      while (true) {
        if (expectedLength == null) {
          const headerEnd = stdoutBuffer.indexOf(Buffer.from("\r\n\r\n"));
          if (headerEnd < 0) break;
          const headerBlock = stdoutBuffer.toString("utf8", 0, headerEnd);
          const match = headerBlock.match(/Content-Length:\s*(\d+)/i);
          if (!match) {
            stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
            continue;
          }
          expectedLength = Number.parseInt(match[1], 10);
          stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
        }

        if (stdoutBuffer.length < expectedLength) break;
        const body = stdoutBuffer.subarray(0, expectedLength).toString("utf8");
        stdoutBuffer = stdoutBuffer.slice(expectedLength);
        expectedLength = null;

        try {
          const response = JSON.parse(body);
          finish(resolve, response);
          return;
        } catch (error) {
          finish(reject, error);
          return;
        }
      }
    });

    child.on("error", (error) => {
      finish(reject, error);
    });

    child.on("exit", (code) => {
      if (!settled) {
        if (isNotification && code === 0) {
          finish(resolve, null);
          return;
        }
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        finish(
          reject,
          new Error(stderr || `MCP child exited before responding (code ${code})`)
        );
      }
    });

    child.stdin.end(framed);
  });
}

async function handleRpc(payload) {
  if (Array.isArray(payload)) {
    const results = [];
    for (const message of payload) {
      const result = await runStdioRequest(message);
      if (result != null) results.push(result);
    }
    return results;
  }
  return runStdioRequest(payload);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (req.method !== "POST" || req.url !== "/mcp") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  try {
    const payload = await parseJsonBody(req);
    const response = await handleRpc(payload);
    if (
      response == null ||
      (Array.isArray(response) && response.length === 0)
    ) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(response));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
        id: null,
      })
    );
  }
});

server.listen(PORT, HOST, () => {
  process.stderr.write(`[kb-mcp-http] listening on http://${HOST}:${PORT}/mcp\n`);
});
