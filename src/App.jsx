import React, { useEffect, useRef, useState, useCallback } from "react";
import styled, { keyframes, css } from "styled-components";

const Stage = styled.div`
  position: fixed;
  inset: 0;
  background: #000;
  overflow: hidden;
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
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.55),
    rgba(0, 0, 0, 0)
  );
  pointer-events: none;
`;

const TopButton = styled.button`
  pointer-events: auto;
  appearance: none;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const ControlBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px 24px max(env(safe-area-inset-bottom), 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  z-index: 6;
`;

const Shutter = styled.button`
  appearance: none;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 4px solid #fff;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.08s ease;
  &:active {
    transform: scale(0.94);
  }
`;

const ShutterInner = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.55); }
  100% { box-shadow: 0 0 0 28px rgba(255, 60, 60, 0); }
`;

const Mic = styled.button`
  appearance: none;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 4px solid #fff;
  background: ${(p) => (p.$recording ? "#ff3b3b" : "rgba(255,255,255,0.12)")};
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
    transform: scale(0.96);
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

// Mode machine: 'live' -> 'captured' -> 'recording' -> 'processing' -> 'result'
// 'result' returns to 'live' on close.

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const facingRef = useRef("environment");

  const [mode, setMode] = useState("live");
  const [photo, setPhoto] = useState(null); // base64 data URL of captured frame
  const [resultImage, setResultImage] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState("environment");
  const [cameraCount, setCameraCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);

  // Mirror when the front camera is selected, or when there's only one
  // camera (typical of a desktop webcam, which faces the user).
  const isMirrored = facing === "user" || cameraCount === 1;

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

      // Now that permission is granted, we can count the video inputs.
      // Before permission, browsers report devices but with empty labels;
      // counts are still accurate, but we wait until after success so we
      // never count phantom devices on browsers that hide them pre-grant.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const count = devices.filter((d) => d.kind === "videoinput").length;
        setCameraCount(count);
      } catch {}
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

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // Mirror the captured frame too if displayed mirrored, so the saved
    // image matches what the user saw on screen.
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
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
    setResultImage(null);
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
      setResultImage(data.image);
      setPhoto(data.image); // replace the photo with the new image
      setMode("result");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
      setMode("captured");
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
  else if (mode === "result") hint = "Tap × to take another";

  return (
    <Stage>
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

      <TopBar>
        <div />
        {mode === "live" ? (
          cameraCount > 1 ? (
            <TopButton onClick={flipCamera}>Flip</TopButton>
          ) : (
            <div />
          )
        ) : (
          <TopButton onClick={resetToLive} disabled={isProcessing}>
            ×
          </TopButton>
        )}
      </TopBar>

      {hint && (mode !== "recording" || !transcript) && (
        <HintBubble>{hint}</HintBubble>
      )}
      {isRecording && transcript && (
        <TranscriptBubble>{transcript}</TranscriptBubble>
      )}

      <ControlBar>
        {mode === "live" && (
          <Shutter onClick={capturePhoto} aria-label="Take photo">
            <ShutterInner />
          </Shutter>
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
          <Shutter onClick={resetToLive} aria-label="Take another">
            <ShutterInner />
          </Shutter>
        )}
      </ControlBar>

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
