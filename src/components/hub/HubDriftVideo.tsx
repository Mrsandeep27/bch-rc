"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Hub — Drift video (section 8). The clip is a VERTICAL 1080×1920 phone
 * capture, so it plays in a native 9:16 "reel" frame — forcing it into a 16:9
 * box (the old placeholder) cropped + upscaled the middle strip, which is what
 * made it look low-quality. Autoplays muted + looped (IntersectionObserver
 * pauses it off-screen to save bandwidth); a tap unmutes to hear the drift.
 */
export default function HubDriftVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Play only while the reel is on screen; pause when scrolled away.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="hub-video" className="bg-brand-ink text-white py-8 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red">See it in action</span>
        <h2 id="hub-video" className="mt-2 font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">
          Watch it send it <span className="text-brand-red">sideways</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-white/70 sm:text-base">
          Real floors, real drift — no CGI. Shot on a real PRC car.
        </p>

        <div className="relative mx-auto mt-5 aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10 shadow-2xl sm:mt-8 sm:max-w-[340px]">
          <video
            ref={videoRef}
            poster="/hero/drift-poster.webp"
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-label="PRC 1:64 die-cast RC drift car drifting on a smooth floor"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/hero/drift-mobile.mp4" type="video/mp4" media="(max-width: 768px)" />
            <source src="/hero/drift.mp4" type="video/mp4" />
          </video>

          {/* Mute / unmute toggle */}
          <button
            type="button"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              const next = !muted;
              setMuted(next);
              el.muted = next;
              if (!next) el.play().catch(() => {});
            }}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </div>
    </section>
  );
}
