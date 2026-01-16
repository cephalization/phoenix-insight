import { create } from "zustand";

// JSONRenderTree type - will be properly typed when @json-render/core is added
// For now, define as a flexible JSON structure that json-render expects
export type JSONRenderTree = Record<string, unknown>;

// Types
export interface Report {
  id: string;
  sessionId: string;
  content: JSONRenderTree;
  createdAt: number;
  title?: string;
}

export interface ReportState {
  reports: Report[];
  currentReportId: string | null;
}

export interface ReportActions {
  setReport: (report: Omit<Report, "id" | "createdAt">) => Report;
  getReportBySession: (sessionId: string) => Report | null;
  deleteReport: (reportId: string) => void;
  listReports: () => Report[];
  getCurrentReport: () => Report | null;
}

export type ReportStore = ReportState & ReportActions;

// Generate a unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useReportStore = create<ReportStore>((set, get) => ({
  // State
  reports: [],
  currentReportId: null,

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
}));
