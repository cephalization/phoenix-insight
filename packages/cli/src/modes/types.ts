/**
 * Common interface for execution modes (sandbox vs local)
 */
export interface ExecutionMode {
  /**
   * Write Phoenix data to the filesystem
   * @param path - The file path relative to the Phoenix root
   * @param content - The content to write
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Execute a bash command and return output
   * @param command - The bash command to execute
   * @returns The command output with stdout, stderr, and exit code
   */
  exec(
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /**
   * Get the bash tool for the AI SDK agent
   * @returns A tool that can be used by the AI SDK
   */
  getBashTool(): Promise<any>; // Tool type from AI SDK

  /**
   * Get the absolute root path of the Phoenix snapshot directory
   * - For sandbox mode: returns "/phoenix/"
   * - For local mode: returns the actual filesystem path (e.g., ~/.phoenix-insight/snapshots/<id>/phoenix/)
   * @returns The absolute path to the snapshot root directory
   */
  getSnapshotRoot(): string;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}
