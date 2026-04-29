import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { Button, Card, Input, Select } from "../components/ui/primitives";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const { token, setSession } = useAuthStore();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "WAREHOUSE",
    phone: "",
    company: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") return authService.login({ email: form.email, password: form.password });
      if (mode === "register") return authService.register(form);
      return authService.forgotPassword({ email: form.email });
    },
    onSuccess: (data) => {
      if (data?.token && data?.user) {
        setSession({ token: data.token, user: data.user });
        navigate("/");
      } else {
        toast.success(data?.message || "Request completed");
      }
    },
  });

  if (token) return <Navigate to="/" replace />;

  const title = mode === "login" ? "Sign in to FreightZen" : mode === "register" ? "Create your workspace access" : "Reset password";
  const subtitle =
    mode === "login"
      ? "Use your warehouse, dealer, or admin account."
      : mode === "register"
        ? "Public registration is limited to warehouse and dealer roles."
        : "The backend always returns a safe response for this action.";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <div className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 text-lg font-semibold">FZ</div>
        <div className="max-w-xl space-y-5">
          <div className="text-sm uppercase tracking-[0.18em] text-slate-400">FreightZen Control Surface</div>
          <h1 className="text-5xl font-semibold tracking-tight">Premium operations UI aligned to the live logistics backend.</h1>
          <p className="text-base text-slate-400">
            Bookings, fleet, invoices, analytics, and ML predictions share one client state and one contract surface.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {["Live bookings", "AI insights", "Role-aware actions"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <Card className="w-full max-w-xl p-8">
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mode === "register" ? (
              <>
                <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                    <option value="WAREHOUSE">Warehouse Manager</option>
                    <option value="DEALER">Truck Dealer</option>
                    <option value="CARGO_DEALER">Cargo Dealer</option>
                  </Select>
                  <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
                <Input label="Company" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
              </>
            ) : null}

            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            {mode !== "forgot" ? (
              <Input label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            ) : null}

            <Button loading={mutation.isPending} type="submit" className="w-full">
              {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
            {mode !== "login" ? <Link to="/login" className="font-medium text-blue-600">Back to login</Link> : <Link to="/forgot-password" className="font-medium text-blue-600">Forgot password</Link>}
            {mode === "login" ? <Link to="/register" className="font-medium text-blue-600">Create account</Link> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
