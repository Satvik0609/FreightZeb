import { Bell, Box, BrainCircuit, ChartColumnBig, FileText, LayoutDashboard, LogOut, Moon, Settings2, Sun, Truck, Users } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authService } from "../../services/authService";
import { notificationService } from "../../services/notificationService";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { Button } from "../ui/primitives";
import { cn, getInitials } from "../../lib/utils";
import { getSocket } from "../../lib/socket";
import { queryClient } from "../../lib/queryClient";
import { useEffect } from "react";
import toast from "react-hot-toast";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/shipments", label: "Shipments", icon: Box, roles: ["ADMIN", "WAREHOUSE", "CARGO_DEALER"] },
  { to: "/trucks", label: "Trucks", icon: Truck, roles: ["ADMIN", "DEALER", "CARGO_DEALER"] },
  { to: "/bookings", label: "Bookings", icon: FileText },
  { to: "/tracking", label: "Tracking", icon: Truck },
  { to: "/analytics", label: "Analytics", icon: ChartColumnBig },
  { to: "/ml-insights", label: "ML Insights", icon: BrainCircuit },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/invoices", label: "Invoices", icon: FileText, roles: ["ADMIN", "WAREHOUSE", "CARGO_DEALER"] },
  { to: "/admin", label: "Admin", icon: Users, roles: ["ADMIN"] },
];

export function AppShell() {
  const navigate = useNavigate();
  const { user, token, logout, patchUser } = useAuthStore();
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUiStore();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
    enabled: Boolean(token),
    staleTime: 60000,
  });

  const { data: notices } = useQuery({
    queryKey: ["notification-count"],
    queryFn: () => notificationService.list({ page: 1, limit: 10 }),
    staleTime: 15000,
  });

  useEffect(() => {
    if (me?.user) patchUser(me.user);
  }, [me, patchUser]);

  useEffect(() => {
    if (!token || !user?.id) return;

    const socket = getSocket(token);
    socket.connect();
    socket.emit("join", `user:${user.id}`);
    socket.emit("join", `${user.role.toLowerCase()}:${user.id}`);
    // CARGO_DEALER uses warehouse room for shipment events
    if (user.role === "CARGO_DEALER") {
      socket.emit("join", `warehouse:${user.id}`);
    }

    const handleNotification = (payload) => {
      toast(payload?.title || "New notification");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    };

    const handleBooking = () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tracking"] });
    };

    const handleTracking = () => {
      queryClient.invalidateQueries({ queryKey: ["tracking"] });
    };

    socket.on("notification", handleNotification);
    socket.on("booking:statusUpdate", handleBooking);
    socket.on("tracking:update", handleTracking);
    socket.on("truck:location", handleTracking);

    return () => {
      socket.off("notification", handleNotification);
      socket.off("booking:statusUpdate", handleBooking);
      socket.off("tracking:update", handleTracking);
      socket.off("truck:location", handleTracking);
      socket.disconnect();
    };
  }, [token, user]);

  const navItems = baseNav.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className={cn("border-r border-slate-200 bg-white/90 p-4 backdrop-blur transition-all duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-950/90", sidebarOpen ? "w-72" : "w-24")}>
        <div className="flex h-full flex-col">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 text-lg font-semibold text-white">FZ</div>
              {sidebarOpen ? (
                <div>
                  <div className="font-semibold tracking-tight">FreightZen</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {{ ADMIN: "Admin", WAREHOUSE: "Warehouse Manager", DEALER: "Truck Dealer", CARGO_DEALER: "Cargo Dealer" }[user?.role] || user?.role}
                  </div>
                </div>
              ) : null}
            </Link>
            <button onClick={toggleSidebar} className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-in-out",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen ? <span>{item.label}</span> : null}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 font-semibold dark:bg-slate-800">
                  {getInitials(user?.name)}
                </div>
                {sidebarOpen ? (
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{user?.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" icon={theme === "dark" ? Sun : Moon} onClick={toggleTheme}>
                {sidebarOpen ? "Theme" : ""}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                icon={LogOut}
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                {sidebarOpen ? "Logout" : ""}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Operations control</div>
              <div className="text-lg font-semibold tracking-tight">Realtime logistics workspace</div>
            </div>
            <Link to="/notifications" className="relative rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <Bell className="h-5 w-5" />
              {(notices?.unreadCount || 0) > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {notices.unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
