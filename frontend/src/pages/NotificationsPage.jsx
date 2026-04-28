import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { notificationService } from "../services/notificationService";
import { formatAgo } from "../lib/utils";
import { Button, Card, CardHeader, EmptyState, Page, VirtualList } from "../components/ui/primitives";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["notifications"], queryFn: () => notificationService.list({ page: 1, limit: 200 }) });

  const markRead = useMutation({
    mutationFn: notificationService.markRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications"]);
      queryClient.setQueryData(["notifications"], (current) => ({
        ...current,
        items: current.items.map((item) => item.id === id ? { ...item, isRead: true } : item),
      }));
      return { previous };
    },
    onError: (_error, _id, context) => context?.previous && queryClient.setQueryData(["notifications"], context.previous),
  });

  const deleteMutation = useMutation({
    mutationFn: notificationService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Page
      title="Notifications"
      subtitle="Realtime delivery lands here and into the personal socket room."
      actions={<Button variant="secondary" onClick={() => notificationService.markAllRead().then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))}>Mark all read</Button>}
    >
      <Card>
        <CardHeader title="Inbox" subtitle={`${notificationsQuery.data?.unreadCount || 0} unread`} />
        <VirtualList
          items={notificationsQuery.data?.items || []}
          height={620}
          rowHeight={108}
          empty={<EmptyState icon={Bell} title="No notifications" message="The platform has not emitted any messages for this account yet." />}
          renderItem={(item) => (
            <div className={`border-b border-slate-200 p-4 dark:border-slate-800 ${item.isRead ? "bg-white dark:bg-slate-900" : "bg-blue-50/50 dark:bg-blue-500/5"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{item.message}</div>
                  <div className="text-xs text-slate-400">{formatAgo(item.createdAt)}</div>
                </div>
                <div className="flex gap-2">
                  {!item.isRead ? <Button variant="secondary" onClick={() => markRead.mutate(item.id)}>Read</Button> : null}
                  <Button variant="secondary" onClick={() => deleteMutation.mutate(item.id)}>Delete</Button>
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </Page>
  );
}
