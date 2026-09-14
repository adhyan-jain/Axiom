import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import PermissionForm from "@/components/PermissionForm";
import PermissionRow from "@/components/PermissionRow";

export const revalidate = 0;

export default async function SettingsPermissionsPage() {
  const permissions = await prisma.permission.findMany({ orderBy: { actionType: "asc" } });

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="border-b border-hairline pb-6">
        <h1 className="display-heading text-display-lg text-ink-primary">Permissions</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Org-scoped authority level per action type — enforced server-side in
          agent-service&apos;s tool layer, never just prompted. Actions with no rule here
          default to RECOMMEND.
        </p>
      </div>

      <Surface tier={1} className="p-5">
        <h2 className="mb-3 display-heading text-display-sm text-ink-primary">Add a rule</h2>
        <PermissionForm />
      </Surface>

      <Surface tier={1} className="overflow-hidden p-0">
        <table className="w-full text-left">
          <thead className="border-b border-hairline bg-surface-2 text-micro uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-3">Action type</th>
              <th className="px-4 py-3">Authority level</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-body-sm text-ink-faint">
                  No permission rules configured yet — every action defaults to RECOMMEND.
                </td>
              </tr>
            ) : (
              permissions.map((p) => <PermissionRow key={p.id} permission={p} />)
            )}
          </tbody>
        </table>
      </Surface>
    </main>
  );
}
