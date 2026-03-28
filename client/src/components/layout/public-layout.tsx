import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Home, User, LogIn } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-7xl mx-auto flex items-center justify-between h-16 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">NestQuest</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/portal/settings")}>
                  <User className="h-4 w-4 mr-2" />
                  {user.name?.split(" ")[0] || "Portal"}
                </Button>
                {user.role === "GUEST" && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/portal/my-bookings")}>
                    My Bookings
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login/guest")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/signup/guest")}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 mt-auto">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                  <Home className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold">NestQuest</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Premium short-term rental properties managed with care.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-sm">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/search" className="hover:text-foreground">Browse Properties</Link></li>
                <li><Link href="/login/guest" className="hover:text-foreground">Guest Login</Link></li>
                <li><Link href="/login/property-manager" className="hover:text-foreground">PM Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>support@nestquest.com</li>
                <li>+971 4 000 0000</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} NestQuest. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
