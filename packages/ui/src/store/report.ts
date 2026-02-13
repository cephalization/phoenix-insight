import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  saveReport as dbSaveReport,
  loadReports as dbLoadReports,
  deleteReport as dbDeleteReport,
} from "@/lib/db";
import type { ReportProgressStatus } from "@/lib/websocket";

// JSONRenderTree type - will be properly typed when @json-render/core is added
// For now, define as a flexible JSON structure that json-render expects
export type JSONRenderTree = Record<string, unknown>;

// Types
export interface Report {
  id: string;
  sessionId: string;
  /** Report content, null when report is being generated */
  content: JSONRenderTree | null;
  createdAt: number;
  title?: string;
}

/**
 * Report generation progress state
 */
export interface ReportGenerationProgress {
  /** Current status of report generation */
  status: ReportProgressStatus;
  /** Optional status message */
  message?: string;
  /** The report title if available */
  title?: string;
  /** Session ID this progress belongs to */
  sessionId: string;
}

export interface ReportState {
  reports: Report[];
  currentReportId: string | null;
  /** Current report generation progress (null if not generating) */
  generationProgress: ReportGenerationProgress | null;
}

export interface ReportActions {
  setReport: (report: Omit<Report, "id" | "createdAt">) => Report;
  getReportBySession: (sessionId: string) => Report | null;
  deleteReport: (reportId: string) => void;
  listReports: () => Report[];
  getCurrentReport: () => Report | null;
  /** Update report generation progress */
  setGenerationProgress: (progress: ReportGenerationProgress | null) => void;
  /** Check if a report is currently being generated */
  isGenerating: () => boolean;
  /** 
   * Start generating a new report - creates a placeholder report with null content
   * and switches to it immediately. Returns the new report's ID.
   */
  startGeneratingReport: (sessionId: string, title?: string) => string;
}

export type ReportStore = ReportState & ReportActions;

// Generate a unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useReportStore = create<ReportStore>()(
  subscribeWithSelector((set, get) => ({
    // State
    reports: [],
    currentReportId: null,
    generationProgress: null,

  // Actions
  setReport: (reportData) => {
    const { sessionId, content, title } = reportData;
    const state = get();

    // Check if a report for this session already exists
    const existingReport = state.reports.find(
      (r) => r.sessionId === sessionId
    );

    if (existingReport) {
      // Update existing report (replaces content)
      const updatedReport: Report = {
        ...existingReport,
        content,
        title: title ?? existingReport.title,
      };

      set((state) => ({
        reports: state.reports.map((r) =>
          r.id === existingReport.id ? updatedReport : r
        ),
        currentReportId: existingReport.id,
      }));

      return updatedReport;
    } else {
      // Create new report (caches previous reports)
      const newReport: Report = {
        id: generateId(),
        sessionId,
        content,
        createdAt: Date.now(),
        title,
      };

      set((state) => ({
        reports: [...state.reports, newReport],
        currentReportId: newReport.id,
      }));

      return newReport;
    }
  },

  getReportBySession: (sessionId) => {
    const state = get();
    return state.reports.find((r) => r.sessionId === sessionId) ?? null;
  },

  deleteReport: (reportId) => {
    set((state) => {
      const newReports = state.reports.filter((r) => r.id !== reportId);
      const newCurrentId =
        state.currentReportId === reportId
          ? newReports.length > 0
            ? newReports[newReports.length - 1].id
            : null
          : state.currentReportId;

      return {
        reports: newReports,
        currentReportId: newCurrentId,
      };
    });
  },

  listReports: () => {
    return get().reports;
  },

  getCurrentReport: () => {
    const state = get();
    if (!state.currentReportId) return null;
    return state.reports.find((r) => r.id === state.currentReportId) ?? null;
  },

  setGenerationProgress: (progress) => {
    set({ generationProgress: progress });
  },

  isGenerating: () => {
    const state = get();
    return (
      state.generationProgress !== null &&
      state.generationProgress.status !== "complete" &&
      state.generationProgress.status !== "error"
    );
  },

  startGeneratingReport: (sessionId, title) => {
    const state = get();
    
    // Check if a report for this session already exists
    const existingReport = state.reports.find((r) => r.sessionId === sessionId);
    
    if (existingReport) {
      // Clear the existing report's content and switch to it
      // This shows loading state on the existing report
      set((state) => ({
        reports: state.reports.map((r) =>
          r.id === existingReport.id
            ? { ...r, content: null, title: title ?? r.title }
            : r
        ),
        currentReportId: existingReport.id,
      }));
      return existingReport.id;
    } else {
      // Create new report with null content (placeholder)
      const newReport: Report = {
        id: generateId(),
        sessionId,
        content: null,
        createdAt: Date.now(),
        title,
      };

      set((state) => ({
        reports: [...state.reports, newReport],
        currentReportId: newReport.id,
      }));

      return newReport.id;
    }
  },
})));

// ============================================
// IndexedDB Persistence Integration
// ============================================

/**
 * Initialize report store from IndexedDB
 * Call this on app startup to load persisted reports
 */
export async function initializeReportStore(): Promise<void> {
  try {
    const reports = await dbLoadReports();
    if (reports.length > 0) {
      useReportStore.setState({
        reports,
        currentReportId: reports[reports.length - 1].id,
      });
    }
  } catch (error) {
    console.error("Failed to load reports from IndexedDB:", error);
  }
}

/**
 * Subscribe to store changes and persist to IndexedDB
 * Returns an unsubscribe function
 */
export function subscribeToReportPersistence(): () => void {
  const unsubscribe = useReportStore.subscribe(
    (state) => state.reports,
    async (reports, previousReports) => {
      const currentIds = new Set(reports.map((r) => r.id));
      const prevIds = new Set(previousReports.map((r) => r.id));

      // Handle deleted reports
      for (const id of prevIds) {
        if (!currentIds.has(id)) {
          try {
            await dbDeleteReport(id);
          } catch (error) {
            console.error(`Failed to delete report ${id} from IndexedDB:`, error);
          }
        }
      }

      // Handle new or updated reports
      for (const report of reports) {
        // Check if report is new or has been modified
        const prevReport = previousReports.find((r) => r.id === report.id);
        if (!prevReport || JSON.stringify(prevReport) !== JSON.stringify(report)) {
          try {
            await dbSaveReport(report);
          } catch (error) {
            console.error(`Failed to save report ${report.id} to IndexedDB:`, error);
          }
        }
      }
    },
    { fireImmediately: false }
  );

  return unsubscribe;
}
