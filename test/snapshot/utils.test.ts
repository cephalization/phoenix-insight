import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Mock modules before imports
vi.mock("node:fs/promises");

// Mock os.homedir to return a predictable path
vi.mock("node:os", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:os");
  return {
    ...actual,
    homedir: vi.fn().mockReturnValue("/mock/home"),
  };
});

// Get mocked functions
const mockAccess = vi.mocked(fs.access);
const mockReaddir = vi.mocked(fs.readdir);
const mockStat = vi.mocked(fs.stat);

// Import after mocks are set up
import {
  listSnapshots,
  getLatestSnapshot,
  getSnapshotsDir,
  type SnapshotInfo,
} from "../../src/snapshot/utils.js";

describe("snapshot/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSnapshotsDir", () => {
    it("should return path under homedir", () => {
      const dir = getSnapshotsDir();
      expect(dir).toBe("/mock/home/.phoenix-insight/snapshots");
    });
  });

  describe("listSnapshots", () => {
    it("should return empty array when snapshots directory does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      const result = await listSnapshots();

      expect(result).toEqual([]);
      expect(mockAccess).toHaveBeenCalledWith("/mock/home/.phoenix-insight/snapshots");
    });

    it("should return empty array when snapshots directory is empty", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([]);

      const result = await listSnapshots();

      expect(result).toEqual([]);
    });

    it("should return empty array when readdir fails", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error("Permission denied"));

      const result = await listSnapshots();

      expect(result).toEqual([]);
    });

    it("should return valid snapshots sorted by timestamp descending", async () => {
      const timestamp1 = Date.now() - 3600000; // 1 hour ago
      const timestamp2 = Date.now() - 7200000; // 2 hours ago
      const timestamp3 = Date.now(); // now

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${timestamp1}-abc123`,
        `${timestamp2}-def456`,
        `${timestamp3}-ghi789`,
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(3);
      // Should be sorted by timestamp descending (most recent first)
      expect(result[0]?.id).toBe(`${timestamp3}-ghi789`);
      expect(result[1]?.id).toBe(`${timestamp1}-abc123`);
      expect(result[2]?.id).toBe(`${timestamp2}-def456`);
    });

    it("should skip directories with invalid name format", async () => {
      const validTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${validTimestamp}-valid`,
        "invalid-no-timestamp",
        "123", // Missing random suffix
        "-abc123", // Missing timestamp
        "not-a-number-abc",
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(`${validTimestamp}-valid`);
    });

    it("should skip directories without phoenix subdirectory", async () => {
      const timestamp1 = Date.now() - 1000;
      const timestamp2 = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${timestamp1}-nophoenix`,
        `${timestamp2}-hasphoenix`,
      ] as any);

      // First call fails (no phoenix dir), second succeeds
      mockStat
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(`${timestamp2}-hasphoenix`);
    });

    it("should skip when phoenix path is a file not a directory", async () => {
      const timestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([`${timestamp}-abc`] as any);
      mockStat.mockResolvedValue({ isDirectory: () => false } as any);

      const result = await listSnapshots();

      expect(result).toEqual([]);
    });

    it("should return correct path to phoenix subdirectory", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-abc123`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe(
        `/mock/home/.phoenix-insight/snapshots/${id}/phoenix`
      );
      expect(result[0]?.id).toBe(id);
      expect(result[0]?.timestamp.getTime()).toBe(timestamp);
    });

    it("should skip directories with unreasonable timestamps", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        "946684800000-abc", // Year 2000 - valid
        "100-xyz", // Too old (year 1970)
        "32503680000000-future", // Year 3000 - valid
        "0-zero", // Invalid
        "-1-negative", // Invalid (won't match regex)
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      // Only year 2000 and year 3000 should be valid
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toContain("946684800000-abc");
      expect(result.map((s) => s.id)).toContain("32503680000000-future");
    });
  });

  describe("getLatestSnapshot", () => {
    it("should return null when no snapshots exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const result = await getLatestSnapshot();

      expect(result).toBeNull();
    });

    it("should return null when snapshots directory is empty", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([]);

      const result = await getLatestSnapshot();

      expect(result).toBeNull();
    });

    it("should return the most recent snapshot", async () => {
      const oldTimestamp = Date.now() - 3600000; // 1 hour ago
      const newTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${oldTimestamp}-old`,
        `${newTimestamp}-new`,
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${newTimestamp}-new`);
      expect(result?.timestamp.getTime()).toBe(newTimestamp);
    });

    it("should return correct snapshot info structure", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-xyz789`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).toEqual({
        path: `/mock/home/.phoenix-insight/snapshots/${id}/phoenix`,
        timestamp: new Date(timestamp),
        id,
      });
    });

    it("should handle single snapshot", async () => {
      const timestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([`${timestamp}-only`] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${timestamp}-only`);
    });
  });

  describe("edge cases", () => {
    it("should handle mixed valid and invalid directories", async () => {
      const validTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        ".DS_Store", // Hidden file
        "node_modules", // Random directory
        `${validTimestamp}-valid`,
        "temp", // No timestamp
        "__pycache__", // Python cache
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(`${validTimestamp}-valid`);
    });

    it("should handle concurrent access gracefully", async () => {
      const timestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([`${timestamp}-abc`] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      // Call multiple times concurrently
      const results = await Promise.all([
        listSnapshots(),
        listSnapshots(),
        getLatestSnapshot(),
      ]);

      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
      expect(results[2]).not.toBeNull();
    });

    it("should handle stat failure for individual directories", async () => {
      const timestamp1 = Date.now() - 1000;
      const timestamp2 = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${timestamp1}-fails`,
        `${timestamp2}-works`,
      ] as any);

      // First stat fails, second succeeds
      mockStat
        .mockRejectedValueOnce(new Error("EACCES"))
        .mockResolvedValueOnce({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(`${timestamp2}-works`);
    });
  });
});
