"use client";

import { useEffect, useRef } from "react";

export function ScrollVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Force load the video
    video.load();

    let targetTime = 0;
    let currentTime = 0;
    let animationFrameId: number;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const maxScroll = docHeight - winHeight;
      const scrollFraction = maxScroll > 0 ? scrollTop / maxScroll : 0;

      if (video.duration) {
        targetTime = scrollFraction * video.duration;
      }
    };

    // Smooth scroll interpolation loop
    const updateVideoTime = () => {
      // Linear interpolation (lerp) for smooth scrubbing
      currentTime += (targetTime - currentTime) * 0.15;
      
      if (Math.abs(currentTime - targetTime) > 0.01) {
        video.currentTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(updateVideoTime);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial calculation
    handleScroll();
    
    // Start animation loop for smooth rendering
    animationFrameId = requestAnimationFrame(updateVideoTime);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden" suppressHydrationWarning>
      <video
        ref={videoRef}
        src="/landpage.mp4"
        muted
        playsInline
        preload="auto"
        suppressHydrationWarning
        className="w-full h-full object-cover opacity-[0.65]"
        style={{ filter: "contrast(1.05) brightness(0.9)" }}
      />
      {/* Subtle overlay to prevent harsh contrast but keep video bright */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-transparent to-slate-950/85 pointer-events-none" />
    </div>
  );
}
