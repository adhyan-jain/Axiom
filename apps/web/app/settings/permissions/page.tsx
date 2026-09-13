import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function SettingsPermissionsPage() {
  const permissions = await prisma.permission.findMany({
    orderBy: { actionType: "asc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Settings / Permissions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure org-scoped authority levels and permission thresholds per action type
          </p>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-6 py-4">Action Type</th>
              <th className="px-6 py-4">Current Authority Level</th>
              <th className="px-6 py-4">Updated At</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  No permissions configured yet.
                </td>
              </tr>
            ) : (
              permissions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {p.actionType}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {p.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(p.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
