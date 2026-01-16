import { useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { ChatPanel } from "@/components/ChatPanel"
import { ReportPanel } from "@/components/ReportPanel"
import { useIsDesktop } from "@/hooks/useMediaQuery"

/**
 * Message icon for chat tab
 */
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/**
 * File/Report icon for report tab
 */
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

/**
 * Desktop layout with resizable side-by-side panels
 */
function DesktopLayout() {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* Left panel - Chat interface */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <ChatPanel className="h-full" />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right panel - Report display */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <ReportPanel className="h-full" />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

/**
 * Mobile layout with tabbed navigation between Chat and Report
 */
function MobileLayout() {
  const [activeTab, setActiveTab] = useState<string>("chat")

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex h-full flex-col"
    >
      {/* Tab content - takes remaining space */}
      <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
        <ChatPanel className="h-full" />
      </TabsContent>
      <TabsContent value="report" className="mt-0 flex-1 overflow-hidden">
        <ReportPanel className="h-full" />
      </TabsContent>

      {/* Tab list at bottom for easy thumb reach */}
      <TabsList className="mx-4 mb-4 mt-2 grid h-12 w-auto grid-cols-2">
        <TabsTrigger
          value="chat"
          className="flex h-10 min-h-[44px] items-center justify-center gap-2"
        >
          <MessageIcon className="h-5 w-5" />
          <span>Chat</span>
        </TabsTrigger>
        <TabsTrigger
          value="report"
          className="flex h-10 min-h-[44px] items-center justify-center gap-2"
        >
          <FileTextIcon className="h-5 w-5" />
          <span>Report</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function App() {
  const isDesktop = useIsDesktop()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toaster />
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Phoenix Insight</h1>
      </header>

      {/* Main content - responsive layout */}
      <main className="flex-1 overflow-hidden">
        {isDesktop ? <DesktopLayout /> : <MobileLayout />}
      </main>
    </div>
  )
}

export default App
