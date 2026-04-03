import React from "react";
import { Link } from "react-router-dom";
import { AeroAccentProvider } from "../landing/AeroAccentContext";
import AeroNavbar from "../landing/AeroNavbar";
import AeroHero from "../landing/AeroHero";
import AeroFeatures from "../landing/AeroFeatures";
import AeroMockup from "../landing/AeroMockup";

function AeroFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050f0d] py-10 text-center text-xs text-white/45">
      <p className="font-medium text-white/60">Aero-WhatsApp · Emotion detection chatbot</p>
      <p className="mt-2 max-w-md mx-auto px-4">
        Palette inspired by WhatsApp® — not affiliated with Meta. Built for learning and demos.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <Link to="/login" className="text-[#25D366] hover:underline">
          Login
        </Link>
        <Link to="/register" className="text-[#25D366] hover:underline">
          Register
        </Link>
        <Link to="/chat" className="text-[#25D366] hover:underline">
          Chat
        </Link>
      </div>
    </footer>
  );
}

export default function AeroWhatsAppLanding() {
  return (
    <AeroAccentProvider>
      <div className="font-landing antialiased">
        <AeroNavbar />
        <main>
          <AeroHero />
          <AeroMockup />
          <AeroFeatures />
        </main>
        <AeroFooter />
      </div>
    </AeroAccentProvider>
  );
}
