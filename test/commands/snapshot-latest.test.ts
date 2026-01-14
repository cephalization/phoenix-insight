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
import { getLatestSnapshot } from "../../src/snapshot/utils.js";

describe("snapshot latest command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getLatestSnapshot integration", () => {
    it("should return the latest snapshot path when snapshots exist", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-abc123`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      expect(result?.path).toBe(
        `/mock/home/.phoenix-insight/snapshots/${id}/phoenix`
      );
    });

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

    it("should select the most recent snapshot when multiple exist", async () => {
      const olderTimestamp = Date.now() - 3600000; // 1 hour ago
      const newerTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        `${olderTimestamp}-older`,
        `${newerTimestamp}-newer`,
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${newerTimestamp}-newer`);
      expect(result?.path).toBe(
        `/mock/home/.phoenix-insight/snapshots/${newerTimestamp}-newer/phoenix`
      );
    });
  });

  describe("command output format", () => {
    it("should produce a clean absolute path without decoration", async () => {
      const timestamp = Date.now();
      const id = `${timestamp}-test`;

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([id] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      // The path should be an absolute path without any decoration
      expect(result?.path).toMatch(/^\/mock\/home\/.phoenix-insight\/snapshots\//);
      expect(result?.path).toMatch(/\/phoenix$/);
      // Path should not contain decorative labels like "Latest snapshot:" or similar
      // (Note: the path naturally contains "snapshots" as part of the directory structure, which is fine)
      expect(result?.path).not.toMatch(/^(Latest|Path):/i);
    });
  });

  describe("error scenarios", () => {
    it("should handle filesystem errors gracefully", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error("Permission denied"));

      const result = await getLatestSnapshot();

      // Should return null rather than throwing
      expect(result).toBeNull();
    });

    it("should skip invalid directory entries", async () => {
      const validTimestamp = Date.now();

      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        "invalid-format",
        ".DS_Store",
        `${validTimestamp}-valid`,
      ] as any);
      mockStat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await getLatestSnapshot();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${validTimestamp}-valid`);
    });
  });
});
