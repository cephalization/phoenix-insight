/**
 * HTTP server for Phoenix Insight UI.
 * Serves the static build of @cephalization/phoenix-insight-ui package.
 *
 * Binds to localhost only for security (no external network access).
 * Handles SPA routing by serving index.html for non-asset routes.
 */

import { createServer, type Server as HttpServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================================
// MIME Type Mapping
// ============================================================================

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json",
};

/**
 * Get MIME type for a file extension
 */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve the UI package dist directory path.
 * Uses import.meta.resolve to find the package location in node_modules.
 */
export function resolveUIDistPath(): string {
  try {
    // Resolve the UI package's package.json using import.meta.resolve
    // import.meta.resolve returns a file URL (file:///...)
    const packageJsonUrl = import.meta.resolve(
      "@cephalization/phoenix-insight-ui/package.json"
    );
    const packageJsonPath = fileURLToPath(packageJsonUrl);
    const packageDir = resolve(packageJsonPath, "..");
    return join(packageDir, "dist");
  } catch {
    // Fallback: try to resolve relative to this file (for development)
    const __dirname = fileURLToPath(new URL(".", import.meta.url));
    return resolve(__dirname, "../../../ui/dist");
  }
}

// ============================================================================
// Server Options
// ============================================================================

export interface UIServerOptions {
  /** Port to listen on (default: 6007) */
  port?: number;
  /** Host to bind to (default: "127.0.0.1" for localhost only) */
  host?: string;
  /** Custom path to UI dist directory (default: auto-resolved) */
  distPath?: string;
}

export interface UIServer {
  /** The underlying HTTP server */
  httpServer: HttpServer;
  /** The port the server is listening on */
  port: number;
  /** The host the server is bound to */
  host: string;
  /** Path to the UI dist directory being served */
  distPath: string;
  /** Close the server */
  close(): Promise<void>;
}

// ============================================================================
// Static File Server
// ============================================================================

/**
 * Determine if a path should be served as a static asset.
 * Asset paths have file extensions (e.g., .js, .css, .png).
 * Non-asset paths (routes) should get the SPA index.html.
 */
function isAssetPath(urlPath: string): boolean {
  // Check for file extension in the last segment
  const lastSegment = urlPath.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

/**
 * Sanitize URL path to prevent directory traversal attacks.
 * Returns null if the path is invalid.
 */
function sanitizePath(urlPath: string, basePath: string): string | null {
  // Decode URI and normalize slashes
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  // Remove query string and hash
  const withoutQuery = decoded.split("?")[0] ?? decoded;
  decoded = withoutQuery.split("#")[0] ?? withoutQuery;

  // Resolve the full path
  const fullPath = resolve(basePath, "." + decoded);

  // Ensure the resolved path is within the base directory
  if (!fullPath.startsWith(basePath)) {
    return null;
  }

  return fullPath;
}

/**
 * Create an HTTP server that serves the Phoenix Insight UI.
 *
 * Features:
 * - Serves static files from the UI package dist directory
 * - SPA fallback: non-asset routes serve index.html
 * - Binds to localhost only (127.0.0.1) for security
 * - Proper MIME types for all common web assets
 *
 * @param options - Server configuration options
 * @returns Promise resolving to UIServer instance
 */
export function createUIServer(options: UIServerOptions = {}): Promise<UIServer> {
  const port = options.port ?? 6007;
  const host = options.host ?? "127.0.0.1";
  const distPath = options.distPath ?? resolveUIDistPath();

  // Verify dist directory exists
  if (!existsSync(distPath)) {
    return Promise.reject(
      new Error(
        `UI dist directory not found at: ${distPath}\n` +
          "Make sure to build the UI package first: pnpm --filter @cephalization/phoenix-insight-ui build"
      )
    );
  }

  // Verify index.html exists
  const indexPath = join(distPath, "index.html");
  if (!existsSync(indexPath)) {
    return Promise.reject(
      new Error(
        `UI index.html not found at: ${indexPath}\n` +
          "Make sure to build the UI package first: pnpm --filter @cephalization/phoenix-insight-ui build"
      )
    );
  }

  return new Promise((resolve, reject) => {
    const httpServer = createServer((req, res) => {
      const urlPath = req.url ?? "/";

      // Sanitize the path to prevent directory traversal
      let filePath = sanitizePath(urlPath, distPath);
      if (!filePath) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
        return;
      }

      // SPA fallback: if not an asset path, serve index.html
      if (!isAssetPath(urlPath)) {
        filePath = indexPath;
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        // For missing assets, return 404
        // For missing routes, serve index.html (SPA)
        if (isAssetPath(urlPath)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        filePath = indexPath;
      }

      // Get file stats
      let stats;
      try {
        stats = statSync(filePath);
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        return;
      }

      // If it's a directory, serve index.html
      if (stats.isDirectory()) {
        filePath = indexPath;
        try {
          stats = statSync(filePath);
        } catch {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
          return;
        }
      }

      // Set response headers
      const mimeType = getMimeType(filePath);
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": stats.size,
        "Cache-Control": filePath === indexPath
          ? "no-cache" // Don't cache index.html for SPA
          : "public, max-age=31536000", // Cache assets for 1 year
      });

      // Stream the file
      const stream = createReadStream(filePath);
      stream.pipe(res);
      stream.on("error", () => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      });
    });

    // Handle server errors
    httpServer.on("error", (err) => {
      reject(err);
    });

    // Start listening
    httpServer.listen(port, host, () => {
      // Get the actual assigned port (important when port 0 is specified)
      const address = httpServer.address();
      const actualPort = typeof address === "object" && address !== null
        ? address.port
        : port;

      resolve({
        httpServer,
        port: actualPort,
        host,
        distPath,
        close(): Promise<void> {
          return new Promise((resolveClose, rejectClose) => {
            httpServer.close((err) => {
              if (err) {
                rejectClose(err);
              } else {
                resolveClose();
              }
            });
          });
        },
      });
    });
  });
}
