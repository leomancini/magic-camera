import React, { useEffect, useRef, useState, useCallback } from "react";
import styled, { keyframes, css } from "styled-components";

const Stage = styled.div`
  position: fixed;
  inset: 0;
  background: #000;
  overflow: hidden;
`;

const Frame = styled.div`
  position: absolute;
  border-radius: 36px;
  overflow: hidden;
  background: #000;

  /* Installed PWA: go full-bleed so the camera reaches the very top,
     tucking under the rounded screen corners, and extends all the way
     down past the home-indicator inset. Detected in JS because iOS
     home-screen apps don't reliably match (display-mode: standalone). */
  ${(p) =>
    p.$standalone
      ? css`
          inset: 0;
        `
      : css`
          top: max(env(safe-area-inset-top), 4px);
          left: 4px;
          right: 4px;
          bottom: max(env(safe-area-inset-bottom), 4px);
        `}
`;

const Video = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Mirror the front camera, like a selfie view, only when applicable */
  transform: ${(p) => (p.$mirror ? "scaleX(-1)" : "none")};
`;

const PhotoStack = styled.div`
  position: absolute;
  inset: 0;
  touch-action: pan-y;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
`;

const PhotoUnder = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
`;

const PhotoReveal = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: ${(p) =>
    p.$dragX < 0
      ? `inset(0 ${-p.$dragX}px 0 0)`
      : p.$dragX > 0
      ? `inset(0 0 0 ${p.$dragX}px)`
      : "inset(0 0 0 0)"};
  transition: ${(p) =>
    p.$dragging ? "none" : "clip-path 0.28s cubic-bezier(0.22, 1, 0.36, 1)"};
  will-change: clip-path;
  pointer-events: none;
`;

const RevealDivider = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  transition: ${(p) =>
    p.$dragging ? "none" : "left 0.28s cubic-bezier(0.22, 1, 0.36, 1)"};
`;

const IconButton = styled.button`
  pointer-events: auto;
  appearance: none;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  transition: background 0.12s ease, transform 0.08s ease;
  &:active {
    transform: scale(0.94);
    background: rgba(0, 0, 0, 0.65);
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
  svg {
    width: 22px;
    height: 22px;
  }
`;

const ControlBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px 32px calc(max(env(safe-area-inset-bottom), 28px) + 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  z-index: 6;
`;

const BottomRightSlot = styled.div`
  position: absolute;
  right: 32px;
  bottom: calc(max(env(safe-area-inset-bottom), 28px) + 12px);
  z-index: 7;
  display: flex;
  align-items: center;
  /* Vertically center against the 76px shutter */
  height: 76px;
`;

const BottomLeftSlot = styled.div`
  position: absolute;
  left: 32px;
  bottom: calc(max(env(safe-area-inset-bottom), 28px) + 12px);
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 76px;
`;

const Shutter = styled.button`
  appearance: none;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.08s ease, background 0.12s ease;
  &:active {
    transform: scale(0.94);
    background: rgba(0, 0, 0, 0.65);
  }
`;

const ShutterDot = styled.div`
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: #fff;
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.55); }
  100% { box-shadow: 0 0 0 28px rgba(255, 60, 60, 0); }
`;

const Mic = styled.button`
  appearance: none;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.08s ease;
  ${(p) =>
    p.$recording &&
    css`
      animation: ${pulse} 1.1s ease-out infinite;
    `}
  &:active {
    transform: scale(0.94);
  }
`;

const MicDot = styled.div`
  width: ${(p) => (p.$recording ? "32px" : "66px")};
  height: ${(p) => (p.$recording ? "32px" : "66px")};
  border-radius: ${(p) => (p.$recording ? "8px" : "50%")};
  background: #ff3b3b;
  transition: width 0.18s ease, height 0.18s ease, border-radius 0.18s ease;
`;

const TranscriptBubble = styled.div`
  position: absolute;
  bottom: calc(max(env(safe-area-inset-bottom), 28px) + 150px);
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.9), 0 0 48px rgba(0, 0, 0, 0.75),
    0 0 12px rgba(0, 0, 0, 0.6);
  width: 92vw;
  max-width: 640px;
  text-align: center;
  pointer-events: none;
  z-index: 5;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.9s linear infinite;
`;

const ProcessingDisc = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ErrorToast = styled.div`
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 60, 60, 0.9);
  color: #fff;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  max-width: 86vw;
  text-align: center;
  z-index: 10;
`;

const PermissionGate = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #fff;
`;

const PermissionTitle = styled.div`
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 10px;
`;

const PermissionButton = styled.button`
  appearance: none;
  border: none;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  padding: 14px 24px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-width: 240px;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  transition: background 0.12s ease, transform 0.08s ease;
  &:active {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
`;

const flash = keyframes`
  0% { opacity: 0; }
  10% { opacity: 1; }
  100% { opacity: 0; }
`;

const Flash = styled.div`
  position: absolute;
  inset: 0;
  background: #fff;
  z-index: 8;
  pointer-events: none;
  animation: ${flash} 0.4s ease-out;
`;

const FlipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <polyline points="21 3 21 8 16 8" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <polyline points="3 21 3 16 8 16" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

// Installed-PWA detection: iOS home-screen apps expose navigator.standalone;
// everything else (Android, desktop) matches the display-mode media query.
const isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia?.("(display-mode: standalone)")?.matches === true;

// Mode machine: 'live' -> 'captured' -> 'recording' -> 'processing' -> 'result'
// 'result' returns to 'live' on close.

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const facingRef = useRef("environment");
  const submittingRef = useRef(false);
  const micPrimedRef = useRef(false);

  const [mode, setMode] = useState("live");
  const [history, setHistory] = useState([]); // list of image URLs / data URLs
  const [viewIndex, setViewIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, pointerId: null });
  const settleTimerRef = useRef(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState("environment");
  const [hasFacingControl, setHasFacingControl] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  // null = still checking; then { cam, mic } with 'granted' | 'prompt' | 'denied'
  const [perms, setPerms] = useState(null);

  const camGranted = perms?.cam === "granted";
  const micGranted = perms?.mic === "granted";
  const needsPermissionGate = perms !== null && (!camGranted || !micGranted);

  // Mirror when the camera is user-facing. If the device can't report a
  // facingMode at all, it's a desktop webcam pointing at the user — mirror
  // it like a selfie view.
  const isMirrored = !hasFacingControl || facing === "user";

  // Start / restart camera
  const startCamera = useCallback(async (mode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Detect whether this device actually has a flippable camera. Only
      // mobile front/back cameras report a `facingMode` in track settings;
      // desktop webcams (and virtual cameras like Continuity, OBS, etc.)
      // don't. This is more reliable than counting videoinput devices.
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      const caps = track?.getCapabilities?.() || {};
      const supportsFacing =
        !!settings.facingMode ||
        (Array.isArray(caps.facingMode) && caps.facingMode.length > 0);
      setHasFacingControl(supportsFacing);
    } catch (err) {
      console.error(err);
      setError("Couldn't open the camera. Check permissions.");
    }
  }, []);

  // Check existing camera/mic permissions once on load. The Permissions API
  // covers Chrome; Safari doesn't support 'camera'/'microphone' queries, so
  // fall back to device labels — enumerateDevices only exposes labels once
  // the matching permission has been granted.
  useEffect(() => {
    (async () => {
      let cam = "prompt";
      let mic = "prompt";
      try {
        const st = await navigator.permissions.query({ name: "camera" });
        cam = st.state;
      } catch {}
      try {
        const st = await navigator.permissions.query({ name: "microphone" });
        mic = st.state;
      } catch {}
      if (cam !== "granted" || mic !== "granted") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (devices.some((d) => d.kind === "videoinput" && d.label))
            cam = "granted";
          if (devices.some((d) => d.kind === "audioinput" && d.label))
            mic = "granted";
        } catch {}
      }
      setPerms({ cam, mic });
    })();
  }, []);

  useEffect(() => {
    facingRef.current = facing;
    if (!camGranted) return;
    startCamera(facing);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, camGranted]);

  const enableCamera = async () => {
    try {
      // Just secure the permission here; the camera effect starts the real
      // stream (with facing + resolution constraints) once cam is granted.
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setPerms((p) => ({ ...p, cam: "granted" }));
    } catch (err) {
      console.error(err);
      setError("Camera permission denied.");
    }
  };

  const enableMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      micPrimedRef.current = true;
      setPerms((p) => ({ ...p, mic: "granted" }));
    } catch (err) {
      console.error(err);
      setError("Microphone permission denied.");
    }
  };

  const flipCamera = () => {
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Downsample to keep the request payload (and Poe round-trip) small.
    // 1024px on the long edge is plenty of detail for image-to-image edits.
    const MAX_DIM = 1024;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // Mirror the captured frame too if displayed mirrored, so the saved
    // image matches what the user saw on screen.
    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setHistory([dataUrl]);
    setViewIndex(0);
    setDragX(0);
    setMode("captured");
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 400);

    // Pause the live stream to save battery while reviewing
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
    }

    // Pre-warm microphone permission so the first tap of the mic button
    // doesn't pause for a permission prompt. We try the Permissions API
    // first — if already granted, we skip getUserMedia entirely to avoid
    // any iOS mic-activation feedback. Otherwise we briefly request and
    // immediately release the stream.
    if (!micPrimedRef.current) {
      micPrimedRef.current = true;
      (async () => {
        try {
          if (navigator.permissions?.query) {
            const status = await navigator.permissions.query({
              name: "microphone"
            });
            if (status.state === "granted") return;
          }
        } catch {}
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
        } catch {}
      })();
    }
  };

  const resetToLive = () => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setHistory([]);
    setViewIndex(0);
    setDragX(0);
    setIsDragging(false);
    setTranscript("");
    transcriptRef.current = "";
    setError(null);
    setMode("live");
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
    } else {
      startCamera(facingRef.current);
    }
  };

  // --- Speech recognition (press-and-hold) ---
  const getRecognitionCtor = () =>
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const startRecording = () => {
    setError(null);
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    transcriptRef.current = "";
    setTranscript("");

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      const combined = (final + " " + interim).trim();
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    rec.onerror = (e) => {
      console.error("Speech error", e);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone permission denied.");
      } else if (e.error === "no-speech") {
        // ignore — user just hadn't started talking yet
      } else {
        setError(`Speech error: ${e.error}`);
      }
    };

    rec.onend = () => {
      // If we stopped because the user released the button, the mode will
      // already have transitioned. Nothing more to do here.
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setMode("recording");
    } catch (err) {
      console.error(err);
      setError("Couldn't start microphone.");
    }
  };

  const stopRecordingAndTransform = async () => {
    // Guard against double-submission: pointerup and pointerleave can both
    // fire on release, and both would otherwise pass the mode check below
    // before any setMode("processing") had taken effect.
    if (submittingRef.current) return;
    submittingRef.current = true;

    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Give the recognizer a beat to flush the last result
    await new Promise((r) => setTimeout(r, 150));

    const finalPrompt = transcriptRef.current.trim();
    if (!finalPrompt) {
      setError("Didn't catch that. Try again.");
      setMode("captured");
      setTranscript("");
      submittingRef.current = false;
      return;
    }

    setMode("processing");

    try {
      const sourceImage = history[viewIndex];
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sourceImage, prompt: finalPrompt })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Decode the new image before swapping the photo, so the previous
      // frame doesn't flash through while the new url paints.
      const preload = new Image();
      preload.src = data.image;
      try {
        if (preload.decode) await preload.decode();
        else
          await new Promise((res, rej) => {
            preload.onload = res;
            preload.onerror = rej;
          });
      } catch {}

      // Always jump to the newly generated photo, even if the user was
      // viewing an older one in the history when they spoke.
      const next = [...history, data.image];
      setHistory(next);
      setViewIndex(next.length - 1);
      setDragX(0);
      setMode("result");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
      setMode("captured");
    } finally {
      submittingRef.current = false;
    }
  };

  // Press-and-hold handlers for the mic button
  const onMicDown = (e) => {
    e.preventDefault();
    if (mode === "captured" || mode === "result") {
      startRecording();
    }
  };
  const onMicUp = (e) => {
    e.preventDefault();
    if (mode === "recording") {
      stopRecordingAndTransform();
    }
  };
  const onMicLeave = () => {
    if (mode === "recording") {
      stopRecordingAndTransform();
    }
  };

  // --- Swipe through photo history (before/after wipe) ---
  // The neighbor photo sits fully in place underneath; dragging clips the
  // current photo away from the drag edge, revealing the neighbor beneath.
  const canSwipe = mode !== "live" && mode !== "processing" && history.length > 1;

  const onSwipeDown = (e) => {
    if (!canSwipe) return;
    if (isDragging || settleTimerRef.current) return;
    dragStartRef.current = { x: e.clientX, pointerId: e.pointerId };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onSwipeMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    // A leftward drag (negative dx) wipes toward an older photo; rightward
    // toward a newer one. Apply rubber-band resistance at the ends.
    let clamped = dx;
    const atOldest = viewIndex === 0;
    const atNewest = viewIndex === history.length - 1;
    if ((atOldest && dx < 0) || (atNewest && dx > 0)) {
      clamped = dx * 0.25;
    }
    setDragX(clamped);
  };

  const onSwipeUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const width = e.currentTarget.offsetWidth || window.innerWidth;
    const threshold = width * 0.2;
    const dx = e.clientX - dragStartRef.current.x;
    const commit = (target, fullDx) => {
      // Animate the wipe to the edge, then swap in the revealed photo as
      // the new unclipped top image.
      setDragX(fullDx);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        setViewIndex(target);
        setDragX(0);
      }, 300);
    };
    if (dx < -threshold && viewIndex > 0) {
      // Dragged left → wipe to an older image (lower index).
      commit(viewIndex - 1, -width);
    } else if (dx > threshold && viewIndex < history.length - 1) {
      // Dragged right → wipe to a newer image (higher index).
      commit(viewIndex + 1, width);
    } else {
      setDragX(0);
    }
  };

  const getCurrentImageFile = async () => {
    const src = history[viewIndex];
    if (!src) return null;
    // Data URLs are same-origin; remote URLs go through our proxy so we
    // can fetch the bytes without CORS surprises.
    const fetchUrl = src.startsWith("data:")
      ? src
      : `/api/image-proxy?url=${encodeURIComponent(src)}`;
    const res = await fetch(fetchUrl);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return new File([blob], `magic-camera-${Date.now()}.${ext}`, {
      type: blob.type || "image/jpeg"
    });
  };

  const downloadFile = (file) => {
    const blobUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const onShare = async () => {
    try {
      const file = await getCurrentImageFile();
      if (!file) return;

      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share({ files: [file] });
        return;
      }

      // Fallback: trigger a download
      downloadFile(file);
    } catch (err) {
      if (err?.name === "AbortError") return; // user dismissed share sheet
      console.error("Share failed:", err);
      setError("Could not save image.");
    }
  };

  const isLive = mode === "live";
  const showPhoto = mode !== "live" && history.length > 0;
  const isRecording = mode === "recording";
  const isProcessing = mode === "processing";

  // Which photo is fully in place underneath the clipped top photo while a
  // wipe is in progress. Null at the ends (rubber-band shows black).
  const underIndex =
    dragX < 0 && viewIndex > 0
      ? viewIndex - 1
      : dragX > 0 && viewIndex < history.length - 1
      ? viewIndex + 1
      : null;

  return (
    <Stage>
      <Frame $standalone={isStandalone}>
        <Video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          $mirror={isMirrored}
          style={{ visibility: isLive ? "visible" : "hidden" }}
        />
        {showPhoto && (
          <PhotoStack
            onPointerDown={onSwipeDown}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeUp}
            onPointerCancel={onSwipeUp}
          >
            {underIndex !== null && (
              <PhotoUnder src={history[underIndex]} alt="" draggable={false} />
            )}
            {/* Keyed by viewIndex so the swap after a wipe remounts the top
                image instead of animating its clip-path from the old value. */}
            <PhotoReveal
              key={viewIndex}
              src={history[viewIndex]}
              alt=""
              draggable={false}
              $dragX={dragX}
              $dragging={isDragging}
            />
            {dragX !== 0 && (
              <RevealDivider
                $dragging={isDragging}
                style={{
                  left:
                    dragX < 0 ? `calc(100% - ${-dragX}px)` : `${dragX}px`
                }}
              />
            )}
          </PhotoStack>
        )}
        {showFlash && <Flash />}
      </Frame>


      {isRecording && transcript && (
        <TranscriptBubble>{transcript}</TranscriptBubble>
      )}

      <ControlBar>
        {mode === "live" && (
          <Shutter onClick={capturePhoto} aria-label="Take photo">
            <ShutterDot />
          </Shutter>
        )}
        {mode !== "live" && !isProcessing && (
          <Mic
            $recording={isRecording}
            onPointerDown={onMicDown}
            onPointerUp={onMicUp}
            onPointerLeave={onMicLeave}
            onPointerCancel={onMicLeave}
            aria-label="Hold to speak"
          >
            <MicDot $recording={isRecording} />
          </Mic>
        )}
        {isProcessing && (
          <ProcessingDisc aria-label="Making magic">
            <Spinner />
          </ProcessingDisc>
        )}
      </ControlBar>

      {mode === "live" && hasFacingControl && (
        <BottomRightSlot>
          <IconButton onClick={flipCamera} aria-label="Flip camera">
            <FlipIcon />
          </IconButton>
        </BottomRightSlot>
      )}

      {mode !== "live" && !isProcessing && (
        <BottomLeftSlot>
          <IconButton onClick={resetToLive} aria-label="Close">
            <XIcon />
          </IconButton>
        </BottomLeftSlot>
      )}

      {mode !== "live" && !isProcessing && history.length > 0 && (
        <BottomRightSlot>
          <IconButton onClick={onShare} aria-label="Share photo">
            <ShareIcon />
          </IconButton>
        </BottomRightSlot>
      )}

      {needsPermissionGate && (
        <PermissionGate>
          <PermissionTitle>Magic Camera needs your permission</PermissionTitle>
          <PermissionButton onClick={enableCamera} disabled={camGranted}>
            {camGranted ? "✓ Camera enabled" : "Enable camera"}
          </PermissionButton>
          <PermissionButton onClick={enableMic} disabled={micGranted}>
            {micGranted ? "✓ Microphone enabled" : "Enable microphone"}
          </PermissionButton>
        </PermissionGate>
      )}

      {error && <ErrorToast onClick={() => setError(null)}>{error}</ErrorToast>}
    </Stage>
  );
}

export default App;
