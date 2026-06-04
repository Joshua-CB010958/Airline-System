import { Toaster as SonnerToaster } from "sonner";

/** App-wide toast surface, themed to the operations-center palette. */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-card text-card-foreground shadow-lg",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
