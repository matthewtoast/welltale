"use client";

import { PlayIcon } from "@heroicons/react/24/solid";
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
    <>
      <style jsx global>{`
        html,
        body {
          height: 100%;
          margin: 0;
          padding: 0;
          font-family:
            "Montserrat Alternates",
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
          background-color: #000;
          color: #fff;
        }

        input,
        textarea,
        button {
          font-family: inherit;
        }

        .play-button {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: #fff;
          color: #000;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .play-button:hover:not(:disabled) {
          background-color: #e5e5e5;
          transform: scale(1.05);
        }

        .play-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .story-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 25px;
          padding: 16px 24px;
          font-size: 18px;
          color: #fff;
          text-align: center;
          outline: none;
          transition: all 0.2s ease;
        }

        .story-input:focus {
          border-color: #10b981;
          background: rgba(255, 255, 255, 0.15);
        }

        .story-input:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .story-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 768px) {
          .story-input {
            font-size: 16px;
            padding: 14px 20px;
          }

          .play-button {
            width: 70px;
            height: 70px;
          }
        }
      `}</style>

      <div className="flex h-screen w-full flex-col bg-black text-white overflow-hidden">
        {/* Header */}
        <div className="flex-none p-4 md:p-6 text-center">
          <h1 className="text-lg md:text-xl font-light text-stone-400">
            {title}
          </h1>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center px-4 md:px-8">
          <div className="max-w-4xl w-full text-center">
            {currentSpeaker && (
              <div className="text-sm md:text-base font-medium text-emerald-400 mb-4 uppercase tracking-widest">
                {currentSpeaker}
              </div>
            )}
            <div className="text-xl md:text-3xl lg:text-4xl font-light leading-relaxed">
              {currentText || (phase === "idle" ? "Press play to begin" : "")}
            </div>
            {error && (
              <div className="mt-8 text-rose-400 text-sm md:text-base">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex-none pb-8 md:pb-12 pt-4 md:pt-8">
          {/* Play button */}
          <div className="flex justify-center mb-6 md:mb-8">
            <button
              onClick={handlePlay}
              disabled={phase === "running" || !canPlay}
              className="play-button"
              type="button"
            >
              <PlayIcon style={{ width: "32px", height: "32px" }} />
            </button>
          </div>

          {/* Input field */}
          <div className="px-4 md:px-8 max-w-2xl mx-auto">
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!isInputActive}
                className="story-input"
                placeholder={isInputActive ? "Type your response..." : ""}
                autoFocus={isInputActive}
              />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
