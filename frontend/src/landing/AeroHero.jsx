import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AERO_HERO_SLIDES } from "../data/aeroHeroSlides";
import { useAuth } from "../hooks/useAuth";
import { AERO_THEME } from "./AeroAccentContext";

function formatSignedInName(user) {
  if (!user) return "";
  const u = user.username != null ? String(user.username).trim() : "";
  if (!u) return "User";
  return u.length === 1 ? u.toUpperCase() : u.charAt(0).toUpperCase() + u.slice(1);
}

export default function AeroHero({ overrideVideoSrc = null } = {}) {
  const { user } = useAuth();
  const signedInLabel = user ? formatSignedInName(user) : "";
  const [index, setIndex] = useState(0);
  /** Pauses auto-advance only; background video keeps playing while hovered. */
  const [carouselPaused, setCarouselPaused] = useState(false);
  const videoRef = useRef(null);
  const overrideVideoRef = useRef(null);
  const slide = AERO_HERO_SLIDES[index] ?? AERO_HERO_SLIDES[0];
  const duration = slide.durationMs ?? 7500;
  const showOverrideVideo = Boolean(overrideVideoSrc);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % AERO_HERO_SLIDES.length);
  }, []);

  const goTo = useCallback((i) => {
    setIndex(i);
  }, []);

  useEffect(() => {
    if (showOverrideVideo) return undefined;
    if (carouselPaused) return undefined;
    const t = window.setTimeout(goNext, duration);
    return () => window.clearTimeout(t);
  }, [index, duration, carouselPaused, goNext, showOverrideVideo]);

  useEffect(() => {
    if (showOverrideVideo) return;
    const v = videoRef.current;
    if (!v) return;
    if (slide?.kind === "video") {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [index, slide?.kind, showOverrideVideo]);

  useEffect(() => {
    const v = overrideVideoRef.current;
    if (!v || !overrideVideoSrc) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [overrideVideoSrc]);

  return (
    <section
      id="landing-hero"
      className="relative min-h-[min(88dvh,820px)] scroll-mt-0 overflow-hidden"
      onMouseEnter={() => !showOverrideVideo && setCarouselPaused(true)}
      onMouseLeave={() => !showOverrideVideo && setCarouselPaused(false)}
    >
      {/* Hero background: optional full-bleed video from feature cards (emotion / mood analytics), else carousel */}
      <div className="absolute inset-0 z-0 bg-[#0a1628]">
        {showOverrideVideo ? (
          <div className="absolute inset-0">
            <video
              key={overrideVideoSrc}
              ref={overrideVideoRef}
              className="h-full w-full scale-105 object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              onLoadedData={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
            >
              <source src={overrideVideoSrc} type="video/mp4" />
            </video>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              {slide.kind === "video" ? (
                <video
                  ref={videoRef}
                  className="h-full w-full scale-105 object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-hidden
                  onLoadedData={(e) => {
                    e.currentTarget.play().catch(() => {});
                  }}
                >
                  <source src={slide.src} type="video/mp4" />
                  {slide.fallbackSrc ? (
                    <source src={slide.fallbackSrc} type="video/mp4" />
                  ) : null}
                </video>
              ) : (
                <img
                  src={slide.src}
                  alt={slide.alt || "Emotion and connection"}
                  className="h-full w-full scale-105 object-cover"
                  decoding="async"
                  fetchPriority="high"
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Readability: cinematic scrim + WhatsApp green depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-[#075E54]/75" aria-hidden />
        <div
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 50% 20%, transparent 0%, ${AERO_THEME.deep} 100%)`,
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/25" aria-hidden />
      </div>

      {/* Slide caption + indicators (hidden while WhatsApp background video is active) */}
      {!showOverrideVideo ? (
        <>
          <p
            className="pointer-events-none absolute bottom-28 left-0 right-0 z-[1] text-center text-[10px] font-medium uppercase tracking-[0.35em] text-white/35 md:bottom-32"
            aria-live="polite"
          >
            {slide?.caption}
          </p>
          <div className="absolute bottom-20 left-0 right-0 z-[2] flex justify-center gap-2 px-4 md:bottom-24">
            {AERO_HERO_SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show slide ${i + 1}: ${s.caption || s.id}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-8 bg-[#25D366] shadow-[0_0_12px_rgba(37,211,102,0.6)]"
                    : "w-1.5 bg-white/35 hover:bg-white/55"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-28 pt-14 text-center md:px-8 md:pb-32 md:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur-md sm:text-[11px]"
        >
          <Sparkles className="h-3 w-3 text-[#25D366]" strokeWidth={2.5} aria-hidden />
          WhatsApp modernized
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06 }}
          className="mx-auto max-w-[22ch] text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-4xl md:max-w-none md:text-[2.75rem] md:leading-[1.1] lg:text-5xl"
          style={{
            textShadow:
              "0 1px 2px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.8)",
          }}
        >
          Chatting, but with{" "}
          <span className="relative inline-block font-extrabold text-[#25D366]">
            Soul
            <span
              className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#25D366] to-transparent opacity-80"
              aria-hidden
            />
          </span>
          .
        </motion.h1>

        {user ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mx-auto mt-4 max-w-md text-sm font-medium text-white/95 md:text-base"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}
          >
            <span className="text-[#25D366]">{signedInLabel}</span>
            <span className="text-white/85"> — you&apos;re logged in. Pick chat, mood dashboard, or journal below.</span>
          </motion.p>
        ) : null}

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: user ? 0.14 : 0.12 }}
          className={`mx-auto max-w-md text-sm font-medium leading-relaxed text-white/90 md:max-w-lg md:text-base md:leading-relaxed ${user ? "mt-4 md:mt-5" : "mt-5 md:mt-6"}`}
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}
        >
          WhatsApp-styled AI that senses your mood and answers with warmth — private, fast, and human.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
        >
          {user ? (
            <>
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold text-[#075E54] shadow-[0_8px_32px_rgba(37,211,102,0.45)] transition hover:brightness-105 active:scale-[0.98] sm:min-w-[240px] sm:py-4"
              >
                Open chat
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#075E54]/12 text-base"
                  aria-hidden
                >
                  ➤
                </span>
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:py-4"
              >
                Mood dashboard
              </Link>
              <Link
                to="/journal"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:py-4"
              >
                Journal
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-sm font-bold text-[#075E54] shadow-[0_8px_32px_rgba(37,211,102,0.45)] transition hover:brightness-105 active:scale-[0.98] sm:min-w-[200px] sm:py-4"
              >
                Start chatting
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#075E54]/12 text-base"
                  aria-hidden
                >
                  ➤
                </span>
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:py-4"
              >
                Create account
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 sm:py-4"
              >
                Log in
              </Link>
            </>
          )}
        </motion.div>

        {carouselPaused && !showOverrideVideo && (
          <p className="mt-4 text-[10px] font-medium uppercase tracking-widest text-white/40">
            Slideshow paused — move away to advance slides
          </p>
        )}
      </div>
    </section>
  );
}
