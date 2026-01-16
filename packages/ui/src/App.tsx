import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <header className="p-4 border-b">
        <h1 className="text-xl font-semibold">Phoenix Insight - shadcn/ui Components Test</h1>
      </header>
      <main className="p-4 space-y-6">
        {/* Alert */}
        <Alert>
          <AlertTitle>Components Loaded</AlertTitle>
          <AlertDescription>
            All shadcn/ui components have been installed successfully.
          </AlertDescription>
        </Alert>

        {/* Button and Badge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Button & Badge
              <Badge>New</Badge>
            </CardTitle>
            <CardDescription>Interactive button and badge components</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => toast("Button clicked!")}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
          </CardContent>
        </Card>

        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Text input field</CardDescription>
          </CardHeader>
          <CardContent>
            <Input placeholder="Type something..." className="max-w-sm" />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
            <CardDescription>Tabbed navigation component</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tab1" className="w-full">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">Content for Tab 1</TabsContent>
              <TabsContent value="tab2">Content for Tab 2</TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Card>
          <CardHeader>
            <CardTitle>Dialog</CardTitle>
            <CardDescription>Modal dialog component</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a modal dialog using shadcn/ui.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Dropdown Menu */}
        <Card>
          <CardHeader>
            <CardTitle>Dropdown Menu</CardTitle>
            <CardDescription>Dropdown menu component</CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Open Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Item 1</DropdownMenuItem>
                <DropdownMenuItem>Item 2</DropdownMenuItem>
                <DropdownMenuItem>Item 3</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        {/* Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>Skeleton</CardTitle>
            <CardDescription>Loading placeholder</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Resizable Panels with ScrollArea */}
        <Card>
          <CardHeader>
            <CardTitle>Resizable Panels with Scroll Area</CardTitle>
            <CardDescription>Resizable layout component</CardDescription>
          </CardHeader>
          <CardContent>
            <ResizablePanelGroup orientation="horizontal" className="min-h-[200px] rounded-lg border">
              <ResizablePanel defaultSize={50}>
                <ScrollArea className="h-full p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Left Panel</p>
                    <p className="text-sm text-muted-foreground">
                      This is a resizable panel with a scroll area.
                    </p>
                  </div>
                </ScrollArea>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50}>
                <ScrollArea className="h-full p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Right Panel</p>
                    <p className="text-sm text-muted-foreground">
                      Drag the handle to resize the panels.
                    </p>
                  </div>
                </ScrollArea>
              </ResizablePanel>
            </ResizablePanelGroup>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default App
