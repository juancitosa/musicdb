import { AlertTriangle } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h1 className="text-2xl font-bold">404 Page Not Found</h1>
        </div>
        <p className="text-sm text-muted-foreground">Did you forget to add the page to the router?</p>
      </div>
    </div>
  );
}
