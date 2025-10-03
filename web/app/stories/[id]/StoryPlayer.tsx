"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { assignInput } from "../../../../lib/StoryConstants";
import { runWithPrefetch } from "../../../../lib/StoryRunnerCorePrefetch";
import {
  createDefaultSession,
  DEFAULT_LLM_SLUGS,
  OP,
  SeamType,
  StoryAdvanceResult,
  StoryMeta,
  StoryOptions,
  StorySession,
} from "../../../../lib/StoryTypes";
import { StoryPlayerUI } from "./StoryPlayerUI";

export function StoryPlayer(props: StoryMeta) {
  const [currentText, setCurrentText] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "running" | "waiting" | "finished" | "error" | "paused"
  >("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<StorySession>(
    createDefaultSession(`web-${props.id}`)
  );
  const optionsRef = useRef<StoryOptions>({
    verbose: true,
    seed: `web-${props.id}`,
    loop: 0,
    ream: 100,
    doGenerateSpeech: true,
    doGenerateAudio: true,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const backgroundAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  async function playAudio(url: string, background = false) {
    if (background) {
      // Background audio - don't block
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      backgroundAudioRefs.current.set(url, audio);

      audio
        .play()
        .catch((err) => console.error("Background audio error:", err));

      audio.addEventListener(
        "ended",
        () => {
          backgroundAudioRefs.current.delete(url);
        },
        { once: true }
      );

      return; // Don't wait
    }

    // Stop any existing foreground audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.crossOrigin = "anonymous";

      await audio.play();

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
      });
    } catch (err) {
      console.error("Audio play error:", err);
    }
  }

  async function showOps(ops: OP[]): Promise<void> {
    for (const op of ops) {
      switch (op.type) {
        case "play-media":
          if (op.event) {
            setCurrentSpeaker(op.event.from || "");
            setCurrentText(op.event.body);
          }
          if (op.media) {
            if (op.background) {
              playAudio(op.media, true); // Don't await
            } else {
              await playAudio(op.media);
            }
          }
          break;

        case "sleep":
          await new Promise((resolve) => setTimeout(resolve, op.duration));
          break;

        case "get-input":
          setPhase("waiting");
          return;

        case "story-end":
          setCurrentText("[The end]");
          setCurrentSpeaker("");
          setPhase("finished");
          return;

        case "story-error":
          setPhase("error");
          setError(op.reason);
          return;

        default:
          console.warn("Unknown op type:", op);
      }
    }
  }

  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    assignInput(sessionRef.current, input);

    try {
      const res = await fetch(`/api/stories/${props.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: sessionRef.current,
          options: optionsRef.current,
        }),
      });

      if (!res.ok) {
        throw new Error("Advance failed");
      }

      const result = (await res.json()) as StoryAdvanceResult;
      sessionRef.current = result.session;
      return result;
    } catch (err) {
      console.error("Advance error:", err);
      return {
        ops: [],
        session: sessionRef.current,
        seam: SeamType.ERROR,
        info: { reason: "Network error" },
        addr: sessionRef.current.address,
      };
    }
  }

  async function handlePlay() {
    const previousPhase = phase;
    if (previousPhase === "running") return;
    if (previousPhase === "paused") {
      if (audioRef.current) {
        audioRef.current
          .play()
          .catch(() => console.warn("Audio resume failed"));
      }
      setPhase("running");
      return;
    }

    setPhase("running");
    setError(null);

    const userInput = previousPhase === "waiting" ? input.trim() : null;
    if (previousPhase === "waiting") {
      setInput("");
      setCurrentText(`${userInput}`);
      setCurrentSpeaker("YOU");
      // Brief pause to show user input
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const result = await runWithPrefetch(userInput, advance, showOps);

    if (result.seam === SeamType.INPUT) {
      setPhase("waiting");
    } else if (result.seam === SeamType.FINISH) {
      setPhase("finished");
    } else if (result.seam === SeamType.ERROR) {
      setPhase("error");
      setError(result.info.reason || "Unknown error");
    } else {
      setPhase("idle");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase === "waiting" && input.trim()) {
      handlePlay();
    }
  }

  function handlePause() {
    if (phase !== "running") {
      console.warn("Pause ignored: player not running");
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Pause all background audio
    backgroundAudioRefs.current.forEach((audio) => audio.pause());
    setPhase("paused");
  }

  function handleSeekBack() {
    console.warn("Seek back not implemented");
  }

  function handleSeekForward() {
    console.warn("Seek forward not implemented");
  }

  function handleBackNav() {
    console.warn("Back navigation not implemented");
  }

  function handleOpenSettings() {
    console.warn("Settings not implemented");
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Stop all background audio
      backgroundAudioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      backgroundAudioRefs.current.clear();
    };
  }, []);

  return (
    <StoryPlayerUI
      {...props}
      currentText={currentText}
      currentSpeaker={currentSpeaker}
      phase={phase}
      input={input}
      error={error}
      canGoNext={false}
      canGoPrev={false}
      onPlayClick={handlePlay}
      onPauseClick={handlePause}
      onBackClick={handleBackNav}
      onSettingsClick={handleOpenSettings}
      onPrevClick={handleSeekBack}
      onNextClick={handleSeekForward}
      onInputChange={setInput}
      onSubmit={handleSubmit}
    />
  );
}
