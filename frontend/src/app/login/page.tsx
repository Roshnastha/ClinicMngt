"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Already signed in? Straight to the dashboard.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        setError("Incorrect email/username or password.");
      } else {
        setError("Unable to sign in. Is the backend running?");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>PhysioDesk</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email or username
            <input
              style={styles.input}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@physiodesk.com"
              autoComplete="username"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            style={{ ...styles.button, opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={styles.hint}>
          Seeded logins: <code>admin@physiodesk.com / admin123</code> ·{" "}
          <code>reception@physiodesk.com / staff123</code>
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 60%)",
    fontFamily: "sans-serif",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    borderRadius: 12,
    padding: "2rem",
    boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
  },
  title: { margin: 0, fontSize: 28 },
  subtitle: { margin: "0.25rem 0 1.5rem", color: "#64748b" },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "0.6rem 0.9rem",
    marginBottom: "1rem",
    fontSize: 14,
  },
  form: { display: "flex", flexDirection: "column" as const, gap: "0.9rem" },
  label: { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 14 },
  input: {
    padding: "0.6rem 0.75rem",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 15,
  },
  button: {
    marginTop: "0.4rem",
    padding: "0.7rem",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer",
  },
  hint: { marginTop: "1.4rem", fontSize: 12, color: "#94a3b8" },
};
