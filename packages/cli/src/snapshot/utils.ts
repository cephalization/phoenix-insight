/**
 * Snapshot discovery utilities
 *
 * Functions for listing and finding snapshots in the local filesystem.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Information about a single snapshot
 */
export interface SnapshotInfo {
  /** Absolute path to the snapshot directory (the 'phoenix' subdirectory) */
  path: string;
  /** Timestamp when the snapshot was created (from directory name) */
  timestamp: Date;
  /** Unique identifier for the snapshot (directory name) */
  id: string;
}

/**
 * Get the base snapshots directory path
 */
export function getSnapshotsDir(): string {
  return path.join(os.homedir(), ".phoenix-insight", "snapshots");
}

/**
 * Parse a snapshot directory name to extract timestamp
 *
 * Directory names are in format: `<timestamp>-<random>` where timestamp is Date.now()
 * Example: "1704067200000-abc123" -> Date(2024-01-01T00:00:00.000Z)
 *
 * @param dirName - The directory name to parse
 * @returns The parsed timestamp as Date, or null if invalid
 */
function parseSnapshotDirName(dirName: string): Date | null {
  // Format: <timestamp>-<random>
  const match = dirName.match(/^(\d+)-[\w]+$/);
  if (!match || !match[1]) {
    return null;
  }

  const timestamp = parseInt(match[1], 10);
  if (isNaN(timestamp) || timestamp <= 0) {
    return null;
  }

  const date = new Date(timestamp);
  // Validate the date is reasonable (between year 2000 and year 3000)
  // Use UTC year to avoid timezone issues
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 3000) {
    return null;
  }

  return date;
}

/**
 * List all available snapshots
 *
 * Scans the snapshots directory and returns information about each valid snapshot.
 * Results are sorted by timestamp descending (most recent first).
 *
 * @returns Array of snapshot info objects, sorted by timestamp descending
 */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const snapshotsDir = getSnapshotsDir();

  // Check if snapshots directory exists
  try {
    await fs.access(snapshotsDir);
  } catch {
    // Directory doesn't exist - return empty array
    return [];
  }

  // Read directory contents
  let entries: string[];
  try {
    entries = await fs.readdir(snapshotsDir);
  } catch {
    // Cannot read directory - return empty array
    return [];
  }

  // Filter and parse valid snapshot directories
  const snapshots: SnapshotInfo[] = [];

  for (const entry of entries) {
    const timestamp = parseSnapshotDirName(entry);
    if (!timestamp) {
      // Invalid directory name format - skip
      continue;
    }

    const snapshotPath = path.join(snapshotsDir, entry, "phoenix");

    // Verify the phoenix subdirectory exists
    try {
      const stat = await fs.stat(snapshotPath);
      if (!stat.isDirectory()) {
        continue;
      }
    } catch {
      // Phoenix subdirectory doesn't exist or can't be accessed - skip
      continue;
    }

    snapshots.push({
      path: snapshotPath,
      timestamp,
      id: entry,
    });
  }

  // Sort by timestamp descending (most recent first)
  snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return snapshots;
}

/**
 * Get the latest (most recent) snapshot
 *
 * @returns The most recent snapshot info, or null if no snapshots exist
 */
export async function getLatestSnapshot(): Promise<SnapshotInfo | null> {
  const snapshots = await listSnapshots();

  if (snapshots.length === 0) {
    return null;
  }

  // First element is the most recent due to descending sort
  return snapshots[0] ?? null;
}
