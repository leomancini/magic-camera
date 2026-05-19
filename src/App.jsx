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

const Photo = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TopBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: max(env(safe-area-inset-top), 16px) 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
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
  transition: transform 0.08s ease, background 0.12s ease;
  &:active {
    transform: scale(0.94);
    background: rgba(0, 0, 0, 0.65);
  }
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
  background: ${(p) =>
    p.$recording ? "#ff3b3b" : "rgba(0, 0, 0, 0.5)"};
  backdrop-filter: ${(p) =>
    p.$recording ? "none" : "blur(24px) saturate(160%)"};
  -webkit-backdrop-filter: ${(p) =>
    p.$recording ? "none" : "blur(24px) saturate(160%)"};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s ease, transform 0.08s ease;
  ${(p) =>
    p.$recording &&
    css`
      animation: ${pulse} 1.1s ease-out infinite;
    `}
  &:active {
    transform: scale(0.94);
  }
  svg {
    width: 38px;
    height: 38px;
  }
`;

const HintBubble = styled.div`
  position: absolute;
  bottom: calc(max(env(safe-area-inset-bottom), 28px) + 130px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TranscriptBubble = styled(HintBubble)`
  background: rgba(255, 60, 60, 0.85);
  white-space: normal;
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

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const FlipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <polyline points="21 3 21 8 16 8" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <polyline points="3 21 3 16 8 16" />
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

  const [mode, setMode] = useState("live");
  const [photo, setPhoto] = useState(null); // base64 data URL of captured frame
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
    setPhoto(dataUrl);
    setMode("captured");
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 400);

    // Pause the live stream to save battery while reviewing
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
    }
  };

  const resetToLive = () => {
    setPhoto(null);
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
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo, prompt: finalPrompt })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Decode the new image before swapping the photo, so the previous
      // frame doesn't flash through while the new data URL paints.
      const preload = new Image();
      preload.src = data.image;
      try {
        if (preload.decode) await preload.decode();
        else
          await new Promise((res, rej) => {
            preload.onload = res;
            preload.onerror = rej;
          });
      } catch {
        // If decode fails we still try to render — worst case is the brief flash
      }

      setPhoto(data.image);
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
    if (mode === "captured") {
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

  const isLive = mode === "live";
  const showPhoto = mode !== "live";
  const isRecording = mode === "recording";
  const isProcessing = mode === "processing";

  let hint = null;
  if (mode === "captured") hint = "Hold to describe what to change";
  else if (mode === "recording")
    hint = transcript ? null : "Listening… speak your prompt";

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
        {showPhoto && photo && <Photo src={photo} alt="captured" />}
        {showFlash && <Flash />}
      </Frame>

      {mode !== "live" && (
        <TopBar>
          <div />
          <IconButton
            onClick={resetToLive}
            disabled={isProcessing}
            aria-label="Close"
          >
            ×
          </IconButton>
        </TopBar>
      )}

      {hint && (mode !== "recording" || !transcript) && (
        <HintBubble>{hint}</HintBubble>
      )}
      {isRecording && transcript && (
        <TranscriptBubble>{transcript}</TranscriptBubble>
      )}

      <ControlBar>
        {mode === "live" && (
          <Shutter onClick={capturePhoto} aria-label="Take photo" />
        )}
        {(mode === "captured" || mode === "recording") && (
          <Mic
            $recording={isRecording}
            onPointerDown={onMicDown}
            onPointerUp={onMicUp}
            onPointerLeave={onMicLeave}
            onPointerCancel={onMicLeave}
            aria-label="Hold to speak"
          >
            <MicIcon />
          </Mic>
        )}
        {mode === "result" && (
          <Shutter onClick={resetToLive} aria-label="Take another" />
        )}
      </ControlBar>

      {mode === "live" && hasFacingControl && (
        <BottomRightSlot>
          <IconButton onClick={flipCamera} aria-label="Flip camera">
            <FlipIcon />
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
