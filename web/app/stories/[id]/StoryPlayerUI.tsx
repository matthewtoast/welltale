import { PlayIcon } from "@heroicons/react/24/solid";
import { FormEvent } from "react";

type Props = {
  title: string;
  currentText: string;
  currentSpeaker: string;
  phase: "idle" | "running" | "waiting" | "finished" | "error";
  input: string;
  error: string | null;
  isInputActive: boolean;
  canPlay: boolean;
  onPlayClick: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function StoryPlayerUI({
  title,
  currentText,
  currentSpeaker,
  phase,
  input,
  error,
  isInputActive,
  canPlay,
  onPlayClick,
  onInputChange,
  onSubmit,
}: Props) {
  return (
    <>
      <style jsx global>{`
        html,
        body {
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: var(--font-sans);
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
        <div className="flex-none p-4 md:p-6 text-center">
          <h1 className="text-lg md:text-xl font-light text-stone-400">
            {title}
          </h1>
        </div>

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

        <div className="flex-none pb-8 md:pb-12 pt-4 md:pt-8">
          <div className="flex justify-center mb-6 md:mb-8">
            <button
              onClick={onPlayClick}
              disabled={phase === "running" || !canPlay}
              className="play-button"
              type="button"
            >
              <PlayIcon style={{ width: "32px", height: "32px" }} />
            </button>
          </div>

          <div className="px-4 md:px-8 max-w-2xl mx-auto">
            <form onSubmit={onSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
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