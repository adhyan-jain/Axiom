import Link from "next/link";

export default function Navigation() {
  const links = [
    { href: "/", label: "Company Pulse" },
    { href: "/events", label: "Inbox / Events" },
    { href: "/actions", label: "Actions & Approvals" },
    { href: "/decisions", label: "Memory & Decisions" },
    { href: "/scenarios", label: "Scenarios" },
    { href: "/integrations", label: "Integrations" },
    { href: "/audit", label: "Audit Log" },
    { href: "/settings/permissions", label: "Permissions" },
  ];

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">
            AXIOM
          </Link>
          <nav className="flex items-center gap-4 text-xs font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
