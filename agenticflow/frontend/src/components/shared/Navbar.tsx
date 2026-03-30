"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store";

const NAV_LINKS = [
  { href: "/builder",   label: "Builder" },
  { href: "/models",    label: "Models" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing",   label: "Pricing" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/[0.07] bg-bg-primary/90 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-sm font-black text-white">AF</div>
        <span className="font-bold text-[17px] tracking-tight">AgenticFlow</span>
      </Link>

      <div className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all font-mono ${
              pathname === link.href
                ? "text-white bg-white/5"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="text-xs font-mono text-white/30 hidden md:block">{user.email}</span>
            <button onClick={logout} className="text-xs font-mono text-white/30 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-xs font-mono text-white/40 hover:text-white px-3 py-1.5 rounded-lg transition-all">
              Login
            </Link>
            <Link href="/builder" className="bg-accent hover:bg-accent-light text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">
              Build Agent →
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
