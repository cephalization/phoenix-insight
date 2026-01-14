import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";

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
import { listSnapshots } from "../../src/snapshot/utils.js";

describe("snapshot list command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listSnapshots integration", () => {
    it("should return all snapshots when multiple exist", async () => {
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

    it("should return empty array when no snapshots exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const result = await listSnapshots();

      expect(result).toEqual([]);
    });

    it("should return empty array when snapshots directory is empty", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([]);

      const result = await listSnapshots();

      expect(result).toEqual([]);
    });
  });

  describe("command output format", () => {
    it("should produce ISO 8601 timestamps", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-test`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      const snapshot = result[0]!;

      // Timestamp should be valid Date
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.timestamp.getTime()).toBe(timestamp);

      // toISOString should produce ISO 8601 format
      const isoString = snapshot.timestamp.toISOString();
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(isoString).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it("should include absolute path to phoenix subdirectory", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-test`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(1);
      const snapshot = result[0]!;

      // Path should be an absolute path
      expect(snapshot.path).toMatch(/^\/mock\/home\/.phoenix-insight\/snapshots\//);
      expect(snapshot.path).toMatch(/\/phoenix$/);
      expect(snapshot.path).toBe(
        `/mock/home/.phoenix-insight/snapshots/${id}/phoenix`
      );
    });

    it("should maintain most recent first order", async () => {
      // Create timestamps in non-sorted order
      const oldest = Date.now() - 7200000; // 2 hours ago
      const middle = Date.now() - 3600000; // 1 hour ago
      const newest = Date.now(); // now

      mockAccess.mockResolvedValue(undefined);
      // Provide in non-sorted order
      mockReaddir.mockResolvedValue([
        `${middle}-middle`,
        `${oldest}-oldest`,
        `${newest}-newest`,
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await listSnapshots();

      expect(result).toHaveLength(3);
      // Verify order: most recent first
      expect(result[0]?.timestamp.getTime()).toBe(newest);
      expect(result[1]?.timestamp.getTime()).toBe(middle);
      expect(result[2]?.timestamp.getTime()).toBe(oldest);
    });
  });

  describe("error scenarios", () => {
    it("should handle filesystem errors gracefully", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error("Permission denied"));

      const result = await listSnapshots();

      // Should return empty array rather than throwing
      expect(result).toEqual([]);
    });

    it("should skip invalid directory entries", async () => {
      const validTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        "invalid-format",
        ".DS_Store",
        `${validTimestamp}-valid`,
        "not-a-snapshot",
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
  });
});
