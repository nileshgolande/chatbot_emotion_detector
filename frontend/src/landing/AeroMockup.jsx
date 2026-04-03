import React from "react";
import { motion } from "framer-motion";
import { CheckCheck } from "lucide-react";

export default function AeroMockup() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0a3d36] to-[#050f0d] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#25D366]/80">
          See it in motion
        </p>
        <h2 className="mt-3 text-center text-3xl font-black text-white md:text-4xl">The hook</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-white/60">
          Hover the device — the interface pulses with the same green energy as a new message.
        </p>

        <div className="mt-14 flex justify-center">
          <motion.div
            className="group relative w-full max-w-[320px] cursor-default"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <motion.div
              className="pointer-events-none absolute -inset-4 rounded-[2.5rem] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background: "radial-gradient(circle at 50% 50%, rgba(37,211,102,0.55), transparent 70%)",
              }}
              aria-hidden
            />
            <div
              className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-[#1f2c34] bg-[#0b141a] shadow-2xl ring-1 ring-white/10 transition-shadow duration-500 group-hover:shadow-[0_0_48px_rgba(37,211,102,0.35)]"
              style={{ aspectRatio: "9 / 19" }}
            >
              <div className="flex h-8 items-center justify-center bg-[#202c33] pt-1">
                <div className="h-5 w-16 rounded-full bg-black/50" aria-hidden />
              </div>
              <div
                className="flex items-center gap-2 border-b border-[#2a3942] bg-[#202c33] px-3 py-2.5"
                style={{ paddingTop: "0.5rem" }}
              >
                <div className="h-9 w-9 rounded-full bg-[#25D366]/30 ring-2 ring-[#25D366]/50" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#e9edef]">Aero Emotion</p>
                  <p className="text-[11px] text-[#8696a0]">online · sensing tone</p>
                </div>
                <CheckCheck className="h-4 w-4 shrink-0 text-[#53bdeb]" aria-hidden />
              </div>

              <div
                className="space-y-3 overflow-y-auto px-2.5 py-4"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232a3942' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                  backgroundColor: "#0b141a",
                  minHeight: "calc(100% - 5.5rem)",
                }}
              >
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-lg rounded-tr-none bg-[#005c4b] px-2.5 py-2 shadow-sm">
                    <p className="text-[13px] leading-snug text-[#e9edef]">
                      I&apos;m having a really tough day at work.
                    </p>
                    <p className="mt-1 text-right text-[10px] text-[#8696a0]">14:02 ✓✓</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="max-w-[90%] rounded-lg rounded-tl-none border border-[#2a3942] px-2.5 py-2 shadow-sm"
                    style={{ backgroundColor: "rgba(59, 130, 246, 0.18)" }}
                  >
                    <p className="text-[13px] leading-snug text-[#e9edef]">
                      I&apos;m so sorry to hear that. Do you want to talk about it or just vent? I&apos;m
                      here either way.
                    </p>
                    <p className="mt-1 text-[10px] text-[#8696a0]">Aero · soft blue tone</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 border-t border-[#2a3942] bg-[#202c33] px-2 py-2">
                <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-2 text-[12px] text-[#8696a0]">
                  Type a message…
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md">
                  ➤
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
