import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, KeyRound, LogOut, Settings, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/gallery", label: "Gallery" },
  { to: "/collections", label: "Collections" },
  { to: "/favorites", label: "Favorites" },
  { to: "/vault", label: "Vault" },
] as const;

export function AppHeader({
  displayName,
  avatarUrl,
}: {
  displayName: string | null;
  avatarUrl?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const initials = (displayName || "L").trim().charAt(0).toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
        <Link to="/gallery" className="shrink-0">
          <span className="font-serif text-2xl tracking-wide text-cream">Lumen</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-4 py-2 text-sm text-cream-muted transition-colors hover:text-cream"
              activeProps={{ className: "rounded-full px-4 py-2 text-sm text-cream bg-panel" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-line bg-ink-2 py-1.5 pl-1.5 pr-3 transition-colors hover:border-amber/50"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-amber font-serif text-base text-ink">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[10rem] truncate text-sm text-cream sm:block">
              {displayName || "Account"}
            </span>
            <ChevronDown className="size-4 text-cream-muted" />
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
              >
                <MenuLink to="/profile" icon={<User className="size-4" />} label="Profile" onDone={() => setOpen(false)} />
                <MenuLink to="/settings" icon={<Settings className="size-4" />} label="Settings" onDone={() => setOpen(false)} />
                <MenuLink
                  to="/change-password"
                  icon={<KeyRound className="size-4" />}
                  label="Change Password"
                  onDone={() => setOpen(false)}
                />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm text-cream transition-colors hover:bg-ink-2"
                >
                  <LogOut className="size-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-cream-muted"
            activeProps={{ className: "whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-cream bg-panel" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function MenuLink({
  to,
  icon,
  label,
  onDone,
}: {
  to: "/profile" | "/settings" | "/change-password";
  icon: React.ReactNode;
  label: string;
  onDone: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onDone}
      className="flex items-center gap-3 px-4 py-3 text-sm text-cream transition-colors hover:bg-ink-2"
    >
      {icon}
      {label}
    </Link>
  );
}
