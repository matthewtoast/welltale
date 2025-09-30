"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { runWithPrefetch } from "../../../../lib/StoryRunnerCorePrefetch";
import {
  DEFAULT_LLM_SLUGS,
  OP,
  PLAYER_ID,
  SeamType,
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
  createDefaultSession,
} from "../../../../lib/StoryTypes";
import { StoryPlayerUI } from "./StoryPlayerUI";

type Props = {
  storyId: string;
  title: string;
};

export function StoryPlayer({ storyId, title }: Props) {
  const [currentText, setCurrentText] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "running" | "waiting" | "finished" | "error"
  >("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<StorySession>(
    createDefaultSession(`web-${storyId}`)
  );
  const optionsRef = useRef<StoryOptions>({
    verbose: false,
    seed: `web-${storyId}`,
    loop: 0,
    ream: 100,
    doGenerateSpeech: true,
    doGenerateAudio: true,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Debug title
  useEffect(() => {
    console.log("StoryPlayer received title:", title, "for storyId:", storyId);
  }, [title, storyId]);

  async function playAudio(url: string) {
    // Stop any existing audio
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
        case "play-event":
          setCurrentSpeaker(op.event.from || "");
          setCurrentText(op.event.body);
          if (op.media) {
            await playAudio(op.media);
          }
          break;

        case "play-media":
          if (op.media) {
            await playAudio(op.media);
          }
          break;

        case "sleep":
          await new Promise((resolve) => setTimeout(resolve, op.duration));
          break;

        case "get-input":
          setPhase("waiting");
          return;

        case "story-end":
          setCurrentText("The End");
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
    if (input !== null) {
      sessionRef.current.input = { atts: {}, body: input, from: PLAYER_ID };
    }

    try {
      const res = await fetch(`/api/stories/${storyId}/advance`, {
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
    if (phase === "running") return;

    setPhase("running");
    setError(null);

    const userInput = phase === "waiting" ? input.trim() : null;
    if (phase === "waiting") {
      setInput("");
      setCurrentText(`> ${userInput}`);
      setCurrentSpeaker("You");
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const isInputActive = phase === "waiting";
  const canPlay =
    phase === "idle" || (phase === "waiting" && input.trim().length > 0);

  return (
    <StoryPlayerUI
      title={title}
      currentText={currentText}
      currentSpeaker={currentSpeaker}
      phase={phase}
      input={input}
      error={error}
      isInputActive={isInputActive}
      canPlay={canPlay}
      onPlayClick={handlePlay}
      onInputChange={setInput}
      onSubmit={handleSubmit}
    />
  );
}
