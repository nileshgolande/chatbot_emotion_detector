/**
 * Hero carousel: slide 0 = uplifting video; rest = high-res emotion / connection imagery (Unsplash).
 * Durations control auto-advance; tweak in one place.
 */
export const HERO_SLIDE_DURATION_MS = 7500;

export const AERO_HERO_SLIDES = [
  {
    id: "video-joy",
    kind: "video",
    /** Uplifting, human — Mixkit free stock (swap `src` if CDN path changes) */
    src: "https://assets.mixkit.co/videos/preview/mixkit-friends-having-a-good-time-in-the-city-42537-large.mp4",
    durationMs: 9000,
    caption: "Joy in motion",
  },
  {
    id: "img-friends",
    kind: "image",
    src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=85",
    alt: "Friends laughing together — connection and joy",
    durationMs: HERO_SLIDE_DURATION_MS,
    caption: "Connection that lifts you",
  },
  {
    id: "img-chat",
    kind: "image",
    src: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1920&q=85",
    alt: "Person smiling while using a phone — mobile chat",
    durationMs: HERO_SLIDE_DURATION_MS,
    caption: "Chat that meets you where you are",
  },
  {
    id: "img-support",
    kind: "image",
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1920&q=85",
    alt: "Professional supportive conversation — empathy",
    durationMs: HERO_SLIDE_DURATION_MS,
    caption: "Empathy, always on",
  },
  {
    id: "img-team",
    kind: "image",
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=85",
    alt: "Team collaborating — trust and togetherness",
    durationMs: HERO_SLIDE_DURATION_MS,
    caption: "You're not alone in the thread",
  },
  {
    id: "img-heart",
    kind: "image",
    src: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1920&q=85",
    alt: "Parent and child — care and emotional safety",
    durationMs: HERO_SLIDE_DURATION_MS,
    caption: "Feelings met with care",
  },
];
