import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../services/adminService";
import { analyticsService } from "../services/analyticsService";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { roles } from "../lib/utils";
import { Button, Card, CardHeader, EmptyState, Page, SearchInput, Select, StatCard, VirtualList } from "../components/ui/primitives";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const usersQuery = useQuery({ queryKey: ["admin-users", role, debouncedSearch], queryFn: () => adminService.listUsers({ role: role || undefined, search: debouncedSearch || undefined, limit: 200 }) });
  const summaryQuery = useQuery({ queryKey: ["admin-summary"], queryFn: analyticsService.adminSummary });

  const toggleMutation = useMutation({
    mutationFn: adminService.toggleUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <Page
      title="Admin"
      subtitle="User controls and platform-wide metrics."
      actions={
        <>
          <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company" />
          <Select value={role} onChange={(event) => setRole(event.target.value)} className="h-11 min-w-44">
            <option value="">All roles</option>
            {roles.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={summaryQuery.data?.analytics?.users?.total || 0} />
        <StatCard title="Shipments" value={summaryQuery.data?.analytics?.shipments?.total || 0} />
        <StatCard title="Trucks" value={summaryQuery.data?.analytics?.trucks?.total || 0} />
        <StatCard title="Bookings" value={summaryQuery.data?.analytics?.bookings?.total || 0} />
      </div>

      <Card>
        <CardHeader title="User management" subtitle="Deactivate accounts when they still own records and cannot be deleted." />
        <VirtualList
          items={usersQuery.data?.items || []}
          height={620}
          rowHeight={102}
          empty={<EmptyState title="No users found" message="The current filter set returned no users." />}
          renderItem={(user) => (
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{user.email} · {user.company || "No company"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={user.role} onChange={(event) => adminService.updateRole(user.id, event.target.value).then(() => queryClient.invalidateQueries({ queryKey: ["admin-users"] }))} className="h-11 min-w-40">
                    {roles.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                  <Button variant="secondary" onClick={() => toggleMutation.mutate(user.id)}>{user.isActive ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </Page>
  );
}
