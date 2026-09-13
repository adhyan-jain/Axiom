import Link from "next/link";

export default function Navigation() {
  const links = [
    { href: "/", label: "Pulse" },
    { href: "/events", label: "Events" },
    { href: "/actions", label: "Actions" },
    { href: "/decisions", label: "Decisions" },
    { href: "/scenarios", label: "Scenarios" },
    { href: "/integrations", label: "Integrations" },
    { href: "/audit", label: "Audit" },
    { href: "/settings/permissions", label: "Permissions" },
  ];

  return (
    <header className="border-b border-hairline bg-surface-1">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="display-heading text-display-sm text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-action rounded-sm"
          >
            AXIOM
          </Link>
          <nav className="flex items-center gap-5 text-body-sm" aria-label="Primary">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ink-secondary transition-colors hover:text-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-action rounded-sm"
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
