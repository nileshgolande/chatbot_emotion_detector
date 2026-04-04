import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { AeroAccentProvider } from "../landing/AeroAccentContext";
import AeroNavbar from "../landing/AeroNavbar";
import AeroHero from "../landing/AeroHero";
import AeroFeatures from "../landing/AeroFeatures";
import { useAuth } from "../hooks/useAuth";

/** Served from `frontend/public/` — copy your `WhatsApp_Chat_Background_Video.mp4` here as this filename. */
const HERO_WHATSAPP_BG_VIDEO = `${process.env.PUBLIC_URL || ""}/whatsapp-hero-background.mp4`;

function AeroFooter() {
  const { user } = useAuth();
  return (
    <footer className="border-t border-white/10 bg-[#050f0d] py-10 text-center text-xs text-white/45">
      <p className="font-medium text-white/60">Aero-WhatsApp · Emotion detection chatbot</p>
      <p className="mt-2 max-w-md mx-auto px-4">
        Palette inspired by WhatsApp® — not affiliated with Meta. Built for learning and demos.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {user ? (
          <>
            <Link to="/chat" className="text-[#25D366] hover:underline">
              Chat
            </Link>
            <Link to="/dashboard" className="text-[#25D366] hover:underline">
              Dashboard
            </Link>
            <Link to="/journal" className="text-[#25D366] hover:underline">
              Journal
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="text-[#25D366] hover:underline">
              Login
            </Link>
            <Link to="/register" className="text-[#25D366] hover:underline">
              Register
            </Link>
            <Link to="/chat" className="text-[#25D366] hover:underline">
              Chat
            </Link>
          </>
        )}
      </div>
    </footer>
  );
}

export default function AeroWhatsAppLanding() {
  const [heroOverrideVideoSrc, setHeroOverrideVideoSrc] = useState(null);

  const onEmotionAwareFeatureClick = useCallback(() => {
    setHeroOverrideVideoSrc(HERO_WHATSAPP_BG_VIDEO);
    requestAnimationFrame(() => {
      document.getElementById("landing-hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <AeroAccentProvider>
      <div className="font-landing antialiased">
        <AeroNavbar />
        <main>
          <AeroHero overrideVideoSrc={heroOverrideVideoSrc} />
          <AeroFeatures onEmotionAwareClick={onEmotionAwareFeatureClick} />
        </main>
        <AeroFooter />
      </div>
    </AeroAccentProvider>
  );
}
