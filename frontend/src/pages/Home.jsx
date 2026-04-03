import React from "react";
import { useAuth } from "../hooks/useAuth";
import AeroWhatsAppLanding from "../components/AeroWhatsAppLanding";

export default function Home() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#075E54] text-white/80">
        Loading…
      </div>
    );
  }

  return <AeroWhatsAppLanding />;
}
