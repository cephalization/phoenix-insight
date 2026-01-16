import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createUIServer,
  resolveUIDistPath,
  type UIServer,
  type UIServerOptions,
} from "../../src/server/ui.js";

/**
 * Temporary directory for test fixtures
 */
let testDistDir: string;

/**
 * Helper to make HTTP GET requests
 */
async function httpGet(
  url: string
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = require("node:http").get(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
      },
      (res: IncomingMessage) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body,
          });
        });
      }
    );
    req.on("error", reject);
  });
}

/**
 * Create a temporary test dist directory with mock UI files
 */
function createTestDistDir(): string {
  const dir = join(tmpdir(), `phoenix-ui-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  
  // Create index.html
  writeFileSync(
    join(dir, "index.html"),
    "<!DOCTYPE html><html><head><title>Phoenix Insight UI</title></head><body><div id=\"root\"></div></body></html>"
  );
  
  // Create assets directory
  mkdirSync(join(dir, "assets"), { recursive: true });
  
  // Create JS file
  writeFileSync(
    join(dir, "assets", "index.abc123.js"),
    "console.log('Phoenix Insight UI');"
  );
  
  // Create CSS file
  writeFileSync(
    join(dir, "assets", "index.def456.css"),
    "body { margin: 0; }"
  );
  
  // Create SVG file
  writeFileSync(
    join(dir, "vite.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'
  );
  
  return dir;
}

/**
 * Clean up test dist directory
 */
function cleanupTestDistDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("resolveUIDistPath", () => {
  it("should return a path string", () => {
    const distPath = resolveUIDistPath();
    expect(typeof distPath).toBe("string");
    expect(distPath.length).toBeGreaterThan(0);
  });

  it("should return a path ending with dist", () => {
    const distPath = resolveUIDistPath();
    expect(distPath).toMatch(/dist$/);
  });
});

describe("createUIServer", () => {
  let server: UIServer | null = null;
  
  beforeAll(() => {
    testDistDir = createTestDistDir();
  });

  afterAll(() => {
    cleanupTestDistDir(testDistDir);
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe("server initialization", () => {
    it("should create a server with default options", async () => {
      server = await createUIServer({ distPath: testDistDir });
      
      expect(server.httpServer).toBeDefined();
      expect(server.port).toBe(6007);
      expect(server.host).toBe("127.0.0.1");
      expect(server.distPath).toBe(testDistDir);
    });

    it("should accept custom port", async () => {
      server = await createUIServer({ 
        port: 0, // Random available port
        distPath: testDistDir 
      });
      
      expect(server.port).toBeGreaterThan(0);
      expect(server.port).not.toBe(6007); // Should be random, very unlikely to be exactly 6007
    });

    it("should accept custom host", async () => {
      server = await createUIServer({ 
        port: 0,
        host: "127.0.0.1",
        distPath: testDistDir 
      });
      
      expect(server.host).toBe("127.0.0.1");
    });

    it("should reject if dist directory does not exist", async () => {
      await expect(
        createUIServer({ distPath: "/nonexistent/path" })
      ).rejects.toThrow("UI dist directory not found");
    });

    it("should reject if index.html does not exist", async () => {
      const emptyDir = join(tmpdir(), `empty-dist-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });
      
      try {
        await expect(
          createUIServer({ distPath: emptyDir })
        ).rejects.toThrow("UI index.html not found");
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("should expose close method", async () => {
      server = await createUIServer({ port: 0, distPath: testDistDir });
      
      expect(typeof server.close).toBe("function");
      await server.close();
      server = null;
    });
  });

  describe("static file serving", () => {
    beforeEach(async () => {
      // Use port 0 to get a random available port for each test
      server = await createUIServer({ port: 0, distPath: testDistDir });
    });

    it("should serve index.html at root", async () => {
      const response = await httpGet(`http://127.0.0.1:${server!.port}/`);
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("<!DOCTYPE html>");
      expect(response.body).toContain("Phoenix Insight UI");
    });

    it("should serve JavaScript files with correct MIME type", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/assets/index.abc123.js`
      );
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/javascript; charset=utf-8");
      expect(response.body).toBe("console.log('Phoenix Insight UI');");
    });

    it("should serve CSS files with correct MIME type", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/assets/index.def456.css`
      );
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/css; charset=utf-8");
      expect(response.body).toBe("body { margin: 0; }");
    });

    it("should serve SVG files with correct MIME type", async () => {
      const response = await httpGet(`http://127.0.0.1:${server!.port}/vite.svg`);
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("image/svg+xml");
      expect(response.body).toContain("<svg");
    });

    it("should return 404 for missing assets", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/assets/nonexistent.js`
      );
      
      expect(response.status).toBe(404);
      expect(response.body).toBe("Not Found");
    });
  });

  describe("SPA fallback", () => {
    beforeEach(async () => {
      server = await createUIServer({ port: 0, distPath: testDistDir });
    });

    it("should serve index.html for non-asset routes", async () => {
      const response = await httpGet(`http://127.0.0.1:${server!.port}/chat`);
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("Phoenix Insight UI");
    });

    it("should serve index.html for nested routes", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/sessions/123/report`
      );
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("Phoenix Insight UI");
    });

    it("should serve index.html for routes with query strings", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/chat?session=abc`
      );
      
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(response.body).toContain("Phoenix Insight UI");
    });
  });

  describe("caching", () => {
    beforeEach(async () => {
      server = await createUIServer({ port: 0, distPath: testDistDir });
    });

    it("should set no-cache for index.html", async () => {
      const response = await httpGet(`http://127.0.0.1:${server!.port}/`);
      
      expect(response.headers["cache-control"]).toBe("no-cache");
    });

    it("should set long cache for static assets", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/assets/index.abc123.js`
      );
      
      expect(response.headers["cache-control"]).toBe("public, max-age=31536000");
    });
  });

  describe("security", () => {
    beforeEach(async () => {
      server = await createUIServer({ port: 0, distPath: testDistDir });
    });

    it("should prevent directory traversal attacks", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/../../../etc/passwd`
      );
      
      // Should serve index.html (SPA fallback) not the passwd file
      expect(response.status).toBe(200);
      expect(response.body).toContain("Phoenix Insight UI");
    });

    it("should handle encoded directory traversal attempts", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd`
      );
      
      // Path decodes to "../../../etc/passwd" which resolves outside dist dir
      // Server correctly rejects this as it tries to access outside the base directory
      expect(response.status).toBe(400);
      expect(response.body).toBe("Bad Request");
    });

    it("should reject malformed URLs", async () => {
      const response = await httpGet(
        `http://127.0.0.1:${server!.port}/%FF%FF%FF`
      );
      
      expect(response.status).toBe(400);
      expect(response.body).toBe("Bad Request");
    });

    it("should bind to localhost only by default", async () => {
      expect(server!.host).toBe("127.0.0.1");
    });
  });

  describe("server lifecycle", () => {
    it("should properly close server", async () => {
      const testServer = await createUIServer({ port: 0, distPath: testDistDir });
      
      // Verify server is running
      const response = await httpGet(`http://127.0.0.1:${testServer.port}/`);
      expect(response.status).toBe(200);
      
      // Close server
      await testServer.close();
      
      // Verify server is closed (should throw connection error)
      await expect(
        httpGet(`http://127.0.0.1:${testServer.port}/`)
      ).rejects.toThrow();
    });

    it("should reject on port in use", async () => {
      // First server
      server = await createUIServer({ port: 0, distPath: testDistDir });
      const usedPort = server.port;
      
      // Second server on same port should fail
      await expect(
        createUIServer({ port: usedPort, distPath: testDistDir })
      ).rejects.toThrow();
    });
  });
});
