'use client'

import { useEffect, useRef } from "react"
import { PlayMediaOptions } from "../../lib/StoryTypes"

type Clip = {
  src: AudioBufferSourceNode
  gain: GainNode
  resolve: () => void
  ended: boolean
}

type AudioBus = {
  play: (op: PlayMediaOptions) => Promise<void>
  stop: () => void
}

function toVolume(vol: number | null): number {
  if (vol === null) return 1
  return vol
}

function toSeconds(ms: number | null): number {
  if (ms === null) return 0
  return ms / 1000
}

function current(ctx: AudioContext): number {
  return ctx.currentTime
}

export function useAudioBus(): AudioBus {
  const ctxRef = useRef<AudioContext | null>(null)
  const clipsRef = useRef<Clip[]>([])

  function stopAll() {
    const list = clipsRef.current.slice(0)
    for (const clip of list) {
      if (clip.ended) continue
      clip.src.onended = null
      clip.ended = true
      clip.src.stop()
      clip.src.disconnect()
      clip.gain.disconnect()
      clip.resolve()
    }
    clipsRef.current.length = 0
    if (!ctxRef.current) return
    ctxRef.current.suspend()
  }

  useEffect(function init() {
    return function destroy() {
      stopAll()
      if (!ctxRef.current) return
      ctxRef.current.close()
      ctxRef.current = null
    }
  }, [])

  function ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (ctxRef.current) return ctxRef.current
    const ctx = new AudioContext()
    ctxRef.current = ctx
    return ctx
  }

  function cleanup(clip: Clip) {
    const list = clipsRef.current
    const idx = list.indexOf(clip)
    if (idx >= 0) list.splice(idx, 1)
    if (clip.ended) return
    clip.ended = true
    clip.src.onended = null
    clip.src.disconnect()
    clip.gain.disconnect()
    clip.resolve()
  }

  function scheduleFade(op: PlayMediaOptions, ctx: AudioContext, gain: GainNode) {
    if (op.fadeDurationMs === null) return
    if (op.fadeAtMs === null) return
    const base = toVolume(op.volume)
    const start = current(ctx) + toSeconds(op.fadeAtMs)
    const end = start + toSeconds(op.fadeDurationMs)
    gain.gain.setValueAtTime(base, start)
    gain.gain.linearRampToValueAtTime(0, end)
  }

  async function play(op: PlayMediaOptions): Promise<void> {
    if (!op.media) return
    const ctx = ensureCtx()
    if (!ctx) {
      console.warn("no audio context")
      return
    }
    await ctx.resume()
    const res = await fetch(op.media).catch(() => null)
    if (!res) {
      console.warn("audio fetch failed")
      return
    }
    if (!res.ok) {
      console.warn("audio fetch status")
      return
    }
    const buf = await res.arrayBuffer().catch(() => null)
    if (!buf) {
      console.warn("audio buffer missing")
      return
    }
    const audio = await ctx.decodeAudioData(buf.slice(0)).catch(() => null)
    if (!audio) {
      console.warn("audio decode failed")
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = audio
    const gain = ctx.createGain()
    const base = toVolume(op.volume)
    gain.gain.setValueAtTime(base, current(ctx))
    src.connect(gain)
    gain.connect(ctx.destination)
    const clip: Clip = { src, gain, resolve: () => {}, ended: false }
    clipsRef.current.push(clip)
    const done = new Promise<void>(function setup(resolve) {
      clip.resolve = resolve
    })
    src.onended = function handleEnd() {
      cleanup(clip)
    }
    scheduleFade(op, ctx, gain)
    src.start()
    if (op.background) return
    await done
  }

  return { play, stop: stopAll }
}
