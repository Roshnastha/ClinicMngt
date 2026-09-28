"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>PhysioDesk</h1>
      <p>Physiotherapy Clinic Management System</p>
      <Link href="/login" style={{ color: "#B8763A" }}>
        Go to login →
      </Link>
    </main>
  );
}
