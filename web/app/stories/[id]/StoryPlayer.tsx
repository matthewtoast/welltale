"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { runWithSkip, triggerSkip } from "../../../../lib/SkipHelpers";
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
  const [isSkippable, setIsSkippable] = useState(false);
  const [hasMoreOps, setHasMoreOps] = useState(false);
  const skipAbortRef = useRef<AbortController | null>(null);
  const emptySource = {
    root: { addr: "", type: "root", atts: {}, kids: [], text: "" },
    voices: {},
    pronunciations: {},
    scripts: {},
    meta: {}
  };
  const sessionRef = useRef<StorySession>(
    createDefaultSession(`web-${props.id}`, emptySource)
  );
  const optionsRef = useRef<StoryOptions>({
    verbose: true,
    seed: `web-${props.id}`,
    loop: 0,
    ream: 100,
    doGenerateAudio: true,
    doGenerateImage: false,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const backgroundAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  async function playAudio(
    url: string,
    background = false,
    signal?: AbortSignal
  ) {
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

      // Handle abort signal
      if (signal) {
        const abortHandler = () => {
          audio.pause();
          audio.currentTime = 0;
          audioRef.current = null;
        };
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      await audio.play();

      // Wait for audio to finish or be aborted
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          audioRef.current = null;
          resolve();
        };

        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", cleanup, { once: true });

        if (signal) {
          signal.addEventListener("abort", cleanup, { once: true });
        }
      });
    } catch (err) {
      if (!signal?.aborted) {
        console.error("Audio play error:", err);
      }
    }
  }

  async function showOps(ops: OP[]): Promise<void> {
    console.log("showOps called with", ops.length, "operations");
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const hasMore = i < ops.length - 1;
      console.log(
        `Op ${i}/${ops.length - 1}: type=${op.type}, hasMore=${hasMore}`
      );
      setHasMoreOps(hasMore);

      switch (op.type) {
        case "play-media":
          if (op.event) {
            setCurrentSpeaker(op.event.from || "");
            setCurrentText(op.event.body);
          }
          if (op.media) {
            console.log(
              `Playing media: ${op.media}, background=${op.background}`
            );
            if (op.background) {
              playAudio(op.media, true); // Don't await
            } else {
              // Wrap non-background audio in runWithSkip
              console.log("Setting isSkippable=true for foreground audio");
              setIsSkippable(true);
              try {
                await runWithSkip(async (signal) => {
                  await playAudio(op.media, false, signal);
                });
              } catch (err) {
                if ((err as any)?.name === "AbortError") {
                  console.log("Audio skipped");
                } else {
                  throw err;
                }
              } finally {
                console.log("Setting isSkippable=false after audio");
                setIsSkippable(false);
              }
            }
          }
          break;

        case "sleep":
          setIsSkippable(true);
          try {
            await runWithSkip(async (signal) => {
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(resolve, op.duration);
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timeout);
                    resolve();
                  },
                  { once: true }
                );
              });
            });
          } catch (err) {
            if ((err as any)?.name === "AbortError") {
              console.log("Sleep skipped");
            } else {
              throw err;
            }
          } finally {
            setIsSkippable(false);
          }
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
    setHasMoreOps(false);
  }

  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    assignInput(sessionRef.current, input);

    try {
      const res = await fetch(`/api/stories/advance`, {
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
        cost: { total: 0, items: [] },
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
    setIsSkippable(false);
    setHasMoreOps(false);

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
    console.log(
      `handleSeekForward called: isSkippable=${isSkippable}, hasMoreOps=${hasMoreOps}`
    );
    if (isSkippable && hasMoreOps) {
      console.log("Triggering skip!");
      triggerSkip();
    } else {
      console.warn(
        `Skip not available: isSkippable=${isSkippable}, hasMoreOps=${hasMoreOps}`
      );
    }
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

  const canGoNext = isSkippable && hasMoreOps;
  console.log(
    `Render: isSkippable=${isSkippable}, hasMoreOps=${hasMoreOps}, canGoNext=${canGoNext}`
  );

  return (
    <StoryPlayerUI
      {...props}
      currentText={currentText}
      currentSpeaker={currentSpeaker}
      phase={phase}
      input={input}
      error={error}
      canGoNext={canGoNext}
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
