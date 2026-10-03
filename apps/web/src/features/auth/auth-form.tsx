"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import type { AuthUser } from "@appointment/contracts";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { loginSchema, signupSchema, type Login, type Signup } from "./schemas";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter(),
    [show, setShow] = useState(false),
    [formError, setFormError] = useState(""),
    [activeDemo, setActiveDemo] = useState<"USER" | "ADMIN" | null>(null);
  const schema = mode === "login" ? loginSchema : signupSchema;
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Login | Signup>({ resolver: zodResolver(schema), mode: "onBlur" });

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setActiveDemo(account.role);
    setFormError("");
    clearErrors();
    setValue("email", account.email, { shouldValidate: true, shouldDirty: true });
    setValue("password", account.password, { shouldValidate: true, shouldDirty: true });
  }

  async function submit(values: Login | Signup) {
    setFormError("");
    try {
      const result = await api<{ user: AuthUser }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.replace(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "INVALID_CREDENTIALS") {
        setError("email", { message: "Email or password is incorrect." });
        setError("password", { message: "Email or password is incorrect." });
        return;
      }
      setFormError(error instanceof Error ? error.message : "We could not complete your request.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="auth-form" noValidate>
      {mode === "login" && (
        <div className="demo-credentials">
          <div className="demo-credentials-head">
            <p className="eyebrow">QUICK TEST ACCESS</p>
            <p className="muted demo-credentials-hint">Tap a role to autofill — no typing needed.</p>
          </div>
          <div className="demo-credentials-grid">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.role === "ADMIN" ? ShieldCheck : UserRound;
              const selected = activeDemo === account.role;
              return (
                <button
                  key={account.role}
                  type="button"
                  className={`demo-chip ${selected ? "demo-chip-active" : ""}`}
                  onClick={() => fillDemo(account)}
                  aria-pressed={selected}
                >
                  <span className="demo-chip-icon">
                    <Icon size={16} />
                  </span>
                  <span className="demo-chip-copy">
                    <strong>{account.label}</strong>
                    <span>{account.email}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {mode === "signup" && (
        <div className="field-group">
          <label className="label" htmlFor="name">
            Full name
          </label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Alex Morgan"
            aria-invalid={!!("name" in errors && errors.name)}
            {...register("name" as never)}
          />
          {"name" in errors && errors.name && (
            <span className="field-error" role="alert">
              {errors.name.message}
            </span>
          )}
        </div>
      )}
      <div className="field-group">
        <label className="label" htmlFor="email">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <span className="field-error" role="alert">
            {errors.email.message}
          </span>
        )}
      </div>
      <div className="field-group">
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="password-wrap">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Enter your password" : "At least 10 characters"}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <span className="field-error" role="alert">
            {errors.password.message}
          </span>
        )}
        {mode === "signup" && !errors.password && (
          <span className="field-hint">Use uppercase, lowercase and a number.</span>
        )}
        {mode === "login" && activeDemo && (
          <span className="field-hint">Password filled: DemoPassword123!</span>
        )}
      </div>
      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}
      <Button className="auth-submit" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle size={17} className="animate-spin" />}
        {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
