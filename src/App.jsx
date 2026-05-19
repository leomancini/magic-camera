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
  top: max(env(safe-area-inset-top), 4px);
  left: 4px;
  right: 4px;
  bottom: max(env(safe-area-inset-bottom), 4px);
  border-radius: 12px;
  overflow: hidden;
  background: #000;

  @media (pointer: coarse) {
    border-radius: 36px;
  }
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

const PhotoSlide = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translate3d(
    calc(${(p) => (p.$viewIndex - p.$index) * 100}% + ${(p) => p.$dragX}px),
    0,
    0
  );
  transition: ${(p) =>
    p.$dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"};
  will-change: transform;
  pointer-events: none;
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
  /* Vertically center against the 84px shutter */
  height: 84px;
`;

const Shutter = styled.button`
  appearance: none;
  width: 84px;
  height: 84px;
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
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff;
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.55); }
  100% { box-shadow: 0 0 0 28px rgba(255, 60, 60, 0); }
`;

const Mic = styled.button`
  appearance: none;
  width: 84px;
  height: 84px;
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
  width: ${(p) => (p.$recording ? "32px" : "56px")};
  height: ${(p) => (p.$recording ? "32px" : "56px")};
  border-radius: ${(p) => (p.$recording ? "8px" : "50%")};
  background: #ff3b3b;
  transition: width 0.18s ease, height 0.18s ease, border-radius 0.18s ease;
`;

const TranscriptBubble = styled.div`
  position: absolute;
  bottom: calc(max(env(safe-area-inset-bottom), 28px) + 130px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 60, 60, 0.85);
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  max-width: 80vw;
  text-align: center;
  pointer-events: none;
  z-index: 5;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #fff;
  font-size: 15px;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.9s linear infinite;
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
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState("environment");
  const [hasFacingControl, setHasFacingControl] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

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

  useEffect(() => {
    startCamera(facing);
    facingRef.current = facing;
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

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

      setHistory((h) => [...h, data.image]);
      setViewIndex((i) => i + 1);
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

  // --- Swipe through photo history ---
  const canSwipe = mode !== "live" && mode !== "processing" && history.length > 1;

  const onSwipeDown = (e) => {
    if (!canSwipe) return;
    if (isDragging) return;
    dragStartRef.current = { x: e.clientX, pointerId: e.pointerId };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onSwipeMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    // Older photos are positioned to the right of the current one and newer
    // to the left, so a leftward drag (negative dx) reveals older history.
    // Apply rubber-band resistance at the ends.
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
    if (dx < -threshold && viewIndex > 0) {
      // Dragged left → reveal an older image (lower index).
      setViewIndex(viewIndex - 1);
    } else if (dx > threshold && viewIndex < history.length - 1) {
      // Dragged right → return to a newer image (higher index).
      setViewIndex(viewIndex + 1);
    }
    setDragX(0);
  };

  const isLive = mode === "live";
  const showPhoto = mode !== "live" && history.length > 0;
  const isRecording = mode === "recording";
  const isProcessing = mode === "processing";

  return (
    <Stage>
      <Frame>
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
            {history.map((url, i) => (
              <PhotoSlide
                key={i}
                src={url}
                alt=""
                draggable={false}
                $index={i}
                $viewIndex={viewIndex}
                $dragX={dragX}
                $dragging={isDragging}
              />
            ))}
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
        {mode !== "live" && (
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
      </ControlBar>

      {mode === "live" && hasFacingControl && (
        <BottomRightSlot>
          <IconButton onClick={flipCamera} aria-label="Flip camera">
            <FlipIcon />
          </IconButton>
        </BottomRightSlot>
      )}

      {mode !== "live" && (
        <BottomRightSlot>
          <IconButton
            onClick={resetToLive}
            disabled={isProcessing}
            aria-label="Close"
          >
            <XIcon />
          </IconButton>
        </BottomRightSlot>
      )}

      {isProcessing && (
        <LoadingOverlay>
          <Spinner />
          <div>Making magic…</div>
        </LoadingOverlay>
      )}

      {error && <ErrorToast onClick={() => setError(null)}>{error}</ErrorToast>}
    </Stage>
  );
}

export default App;
