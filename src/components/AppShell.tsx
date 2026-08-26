import { Link } from "@tanstack/react-router";
import { FileCheck2, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div
          className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 ${wide ? "max-w-none" : "max-w-6xl"}`}
        >
          <Link to="/dashboard" className="flex items-center gap-2 rounded-md">
            <FileCheck2 className="size-5 text-primary" aria-hidden="true" />
            <span className="font-display text-base font-semibold tracking-tight">AccessPDF</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            {user ? (
              <>
                <span className="hidden max-w-40 truncate px-2 text-sm text-muted-foreground sm:inline">
                  {user.email}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                  <LogOut className="size-4" aria-hidden="true" />
                  <span>Sign out</span>
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
