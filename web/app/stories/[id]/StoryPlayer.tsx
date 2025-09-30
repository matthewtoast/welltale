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
import { useAudioBus } from "../../../hooks/useAudioBus"

type LogItem =
  | { id: string; type: "event"; from: string; body: string }
  | { id: string; type: "media"; url: string }
  | { id: string; type: "system"; text: string }

type Ask = {
  limit: number | null
}

type Props = {
  storyId: string
  title: string
}

type Phase =
  | "idle"
  | "running"
  | "waiting"
  | "paused"
  | "finished"
  | "error"

function toReason(info: Record<string, string>): string {
  const keys = Object.keys(info)
  if (keys.length === 0) return "Unknown error"
  const first = keys.find((key) => typeof info[key] === "string")
  if (!first) return "Unknown error"
  return info[first]
}

function buildOpts(seed: string): StoryOptions {
  return {
    verbose: false,
    seed,
    loop: 0,
    ream: 100,
    doGenerateSpeech: true,
    doGenerateAudio: true,
    maxCheckpoints: 20,
    inputRetryMax: 3,
    models: DEFAULT_LLM_SLUGS,
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function nextId(counter: { value: number }): string {
  counter.value += 1
  return `${counter.value}`
}

function errorResult(session: StorySession, reason: string): StoryAdvanceResult {
  return {
    ops: [],
    session,
    seam: SeamType.ERROR,
    info: { reason },
    addr: session.address,
  }
}

export function StoryPlayer({ storyId, title }: Props) {
  const audio = useAudioBus()
  const [log, setLog] = useState<LogItem[]>([])
  const [phase, setPhase] = useState<Phase>("idle")
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState("")
  const [ask, setAsk] = useState<Ask | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const sessRef = useRef<StorySession | null>(null)
  const optRef = useRef<StoryOptions>(buildOpts(`web-${storyId}`))
  const idRef = useRef<{ value: number }>({ value: 0 })
  const liveRef = useRef(true)

  useEffect(function mount() {
    sessRef.current = createDefaultSession(`web-${storyId}`)
    return function unmount() {
      liveRef.current = false
      audio.stop()
    }
  }, [audio, storyId])

  function pushLog(item: LogItem) {
    setLog((prev) => [...prev, item])
  }

  async function showOps(ops: OP[]): Promise<void> {
    for (const op of ops) {
      if (!liveRef.current) return
      if (op.type === "play-event") {
        pushLog({
          id: nextId(idRef.current),
          type: "event",
          from: op.event.from,
          body: op.event.body,
        })
        if (op.background) {
          void audio.play(op)
          continue
        }
        await audio.play(op)
        continue
      }
      if (op.type === "play-media") {
        pushLog({
          id: nextId(idRef.current),
          type: "media",
          url: op.media,
        })
        if (op.background) {
          void audio.play(op)
          continue
        }
        await audio.play(op)
        continue
      }
      if (op.type === "sleep") {
        await delay(op.duration)
        continue
      }
      if (op.type === "get-input") {
        setAsk({ limit: op.timeLimit })
        continue
      }
      if (op.type === "story-end") {
        pushLog({ id: nextId(idRef.current), type: "system", text: "Story complete" })
        continue
      }
      if (op.type === "story-error") {
        pushLog({ id: nextId(idRef.current), type: "system", text: op.reason })
        continue
      }
    }
  }

  async function advance(input: string | null): Promise<StoryAdvanceResult> {
    if (!sessRef.current) {
      sessRef.current = createDefaultSession(`web-${storyId}`)
    }
    const session = sessRef.current
    if (input !== null) {
      if (!session.input) {
        session.input = { atts: {}, body: input, from: PLAYER_ID }
      } else {
        session.input.body = input
      }
    }
    const res = await fetch(`/api/stories/${storyId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session, options: optRef.current }),
    }).catch(() => null)
    if (!res) {
      console.warn("advance failed")
      return errorResult(session, "Network error")
    }
    if (!res.ok) {
      console.warn("advance status")
      return errorResult(session, "Advance failed")
    }
    const data = (await res.json().catch(() => null)) as StoryAdvanceResult | null
    if (!data) {
      console.warn("advance parse")
      return errorResult(session, "Invalid response")
    }
    sessRef.current = data.session
    return data
  }

  async function run() {
    if (busy) return
    setBusy(true)
    setErr(null)
    setAsk(null)
    setPhase("running")
    const payload = phase === "waiting" ? input.trim() : null
    if (phase === "waiting") {
      setInput("")
    }
    const result = await runWithPrefetch(payload, advance, showOps).catch(() => null)
    if (!liveRef.current) return
    if (!result) {
      setPhase("error")
      setErr("Playback failed")
      setBusy(false)
      return
    }
    if (result.seam === SeamType.INPUT) {
      setPhase("waiting")
      setBusy(false)
      return
    }
    if (result.seam === SeamType.FINISH) {
      setPhase("finished")
      setBusy(false)
      return
    }
    if (result.seam === SeamType.ERROR) {
      setPhase("error")
      setErr(toReason(result.info))
      setBusy(false)
      return
    }
    setPhase("idle")
    setBusy(false)
  }

  function handleToggle() {
    if (phase === "running" && busy) {
      audio.stop()
      setPhase("paused")
      return
    }
    run()
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (phase !== "waiting") return
    run()
  }

  function renderLog(item: LogItem) {
    if (item.type === "event") {
      return (
        <div key={item.id} className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-stone-200">{item.from}</div>
          <div className="rounded-md bg-stone-800/60 px-3 py-2 text-sm text-stone-100">{item.body}</div>
        </div>
      )
    }
    if (item.type === "media") {
      return (
        <div key={item.id} className="text-xs italic text-stone-400">Playing {item.url}</div>
      )
    }
    return (
      <div key={item.id} className="text-sm text-rose-400">{item.text}</div>
    )
  }

  const isPlayDisabled = busy && phase !== "running"
  const buttonLabel = phase === "running" && busy ? "Pause" : "Play"

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-stone-950 px-4 py-8 text-stone-100">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-stone-50">{title}</h1>
          <div className="text-sm text-stone-400">Story ID: {storyId}</div>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 shadow-lg shadow-stone-950/50">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPlayDisabled}
              className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {buttonLabel}
            </button>
            <div className="text-xs uppercase tracking-wide text-stone-500">{phase}</div>
          </div>
        </div>
        <div className="h-80 overflow-y-auto rounded-xl border border-stone-800 bg-stone-900/40 p-4 space-y-4">
          {log.map((item) => renderLog(item))}
        </div>
        {phase === "waiting" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-sm font-medium text-stone-200">Your Response</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-24 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-emerald-400 focus:outline-none"
            />
            <div className="flex items-center justify-between text-xs text-stone-500">
              <div>
                {ask && ask.limit !== null ? `Time limit: ${ask.limit} ms` : "No time limit"}
              </div>
              <button
                type="submit"
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-emerald-400"
              >
                Send
              </button>
            </div>
          </form>
        )}
        {err && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {err}
          </div>
        )}
      </div>
    </div>
  )
}
