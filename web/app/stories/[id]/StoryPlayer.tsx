'use client'

import { FormEvent, useEffect, useRef, useState } from "react"
import { runWithPrefetch } from "../../../../lib/StoryRunnerCorePrefetch"
import {
  DEFAULT_LLM_SLUGS,
  OP,
  PLAYER_ID,
  SeamType,
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
  createDefaultSession,
} from "../../../../lib/StoryTypes"

type Props = {
  storyId: string
  title: string
}

export function StoryPlayer({ storyId, title }: Props) {
  const [log, setLog] = useState<string[]>([])
  const [phase, setPhase] = useState<"idle" | "running" | "waiting" | "finished" | "error">("idle")
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<StorySession>(createDefaultSession(`web-${storyId}`))
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
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function addLog(message: string) {
    setLog(prev => [...prev, message])
  }

  async function playAudio(url: string) {
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    try {
      const audio = new Audio(url)
      audioRef.current = audio
      audio.crossOrigin = "anonymous"
      
      await audio.play()
      
      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.addEventListener('ended', () => resolve(), { once: true })
        audio.addEventListener('error', () => resolve(), { once: true })
      })
    } catch (err) {
      console.error("Audio play error:", err)
    }
  }

  async function showOps(ops: OP[]): Promise<void> {
    for (const op of ops) {
      switch (op.type) {
        case "play-event":
          if (op.event.from) {
            addLog(`${op.event.from}: ${op.event.body}`)
          } else {
            addLog(op.event.body)
          }
          if (op.media) {
            await playAudio(op.media)
          }
          break
          
        case "play-media":
          addLog(`[Playing audio: ${op.media}]`)
          await playAudio(op.media)
          break
          
        case "sleep":
          await new Promise(resolve => setTimeout(resolve, op.duration))
          break
          
        case "get-input":
          setPhase("waiting")
          return
          
        case "story-end":
          addLog("[Story complete]")
          setPhase("finished")
          return
          
        case "story-error":
          addLog(`[Error: ${op.reason}]`)
          setPhase("error")
          setError(op.reason)
          return
          
        default:
          console.warn("Unknown op type:", op)
      }
    }
  }

  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    if (input !== null) {
      sessionRef.current.input = { atts: {}, body: input, from: PLAYER_ID }
    }
    
    try {
      const res = await fetch(`/api/stories/${storyId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          session: sessionRef.current, 
          options: optionsRef.current 
        }),
      })
      
      if (!res.ok) {
        throw new Error("Advance failed")
      }
      
      const result = await res.json() as StoryAdvanceResult
      sessionRef.current = result.session
      return result
    } catch (err) {
      console.error("Advance error:", err)
      return {
        ops: [],
        session: sessionRef.current,
        seam: SeamType.ERROR,
        info: { reason: "Network error" },
        addr: sessionRef.current.address,
      }
    }
  }

  async function handlePlay() {
    if (phase === "running") return
    
    setPhase("running")
    setError(null)
    
    const userInput = phase === "waiting" ? input.trim() : null
    if (phase === "waiting") {
      setInput("")
      addLog(`> ${userInput}`)
    }
    
    const result = await runWithPrefetch(userInput, advance, showOps)
    
    if (result.seam === SeamType.INPUT) {
      setPhase("waiting")
    } else if (result.seam === SeamType.FINISH) {
      setPhase("finished")
    } else if (result.seam === SeamType.ERROR) {
      setPhase("error")
      setError(result.info.reason || "Unknown error")
    } else {
      setPhase("idle")
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase === "waiting" && input.trim()) {
      handlePlay()
    }
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-stone-950 px-4 py-8 text-stone-100">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-stone-50">{title}</h1>
          <div className="text-sm text-stone-400">Story ID: {storyId}</div>
        </div>
        
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePlay}
              disabled={phase === "running" || phase === "finished"}
              className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {phase === "waiting" ? "Continue" : "Play"}
            </button>
            <div className="text-xs uppercase tracking-wide text-stone-500">{phase}</div>
          </div>
        </div>
        
        <div className="h-80 overflow-y-auto rounded-xl border border-stone-700 bg-stone-900/60 p-4 space-y-2">
          {log.map((text, i) => (
            <div key={i} className="text-sm text-stone-100 whitespace-pre-wrap">{text}</div>
          ))}
        </div>
        
        {phase === "waiting" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 resize-none focus:border-emerald-400 focus:outline-none"
              placeholder="Enter your response..."
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
        
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}