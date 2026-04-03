import React from "react";
import { motion } from "framer-motion";
import { CheckCheck, Lock, MessageCircle } from "lucide-react";

const cards = [
  {
    title: "Emotional double-ticks",
    body: "We don't just read your messages; we feel them.",
    Icon: CheckCheck,
    glow: true,
  },
  {
    title: "Dynamic bubbles",
    body: "Chat bubbles that shift colors based on your emotion. Green for happy, soft blue for venting.",
    Icon: MessageCircle,
    glow: false,
  },
  {
    title: "Encrypted empathy",
    body: "Your feelings are private. End-to-end encrypted mood tracking stored in PostgreSQL.",
    Icon: Lock,
    glow: false,
  },
];

export default function AeroFeatures() {
  return (
    <section className="relative border-t border-white/10 bg-[#075E54] py-20 md:py-28">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#075E54_0%,#0a3d36_100%)] opacity-90" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#25D366]/90">
          The WhatsApp DNA
        </p>
        <h2 className="mt-3 text-center text-3xl font-black text-white md:text-4xl">Built like the app you trust</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-white/65">
          Familiar patterns — elevated for emotional intelligence.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map(({ title, body, Icon, glow }, i) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl backdrop-blur-sm transition hover:border-[#25D366]/40 hover:bg-white/[0.09]"
            >
              <div
                className={`mb-5 inline-flex rounded-2xl bg-[#128C7E]/50 p-4 ${
                  glow ? "shadow-[0_0_28px_rgba(37,211,102,0.45)]" : ""
                }`}
              >
                <Icon
                  className={`h-8 w-8 ${glow ? "text-[#25D366] drop-shadow-[0_0_12px_rgba(37,211,102,0.85)]" : "text-[#25D366]"}`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
