import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Toaster } from "@/components/ui/sonner"

function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toaster />
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Phoenix Insight</h1>
      </header>

      {/* Main content with resizable panels */}
      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Left panel - Chat interface */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex h-10 shrink-0 items-center border-b px-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Chat
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground">
                {/* Placeholder for ChatPanel component */}
                Chat interface will be rendered here
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel - Report display */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex h-10 shrink-0 items-center border-b px-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Report
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground">
                {/* Placeholder for ReportPanel component */}
                Report display will be rendered here
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}

export default App
