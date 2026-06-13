'use client'

import { useEffect, useRef, useState } from 'react'
import type { EntriesMap, JournalEntry, PersonaKey } from './journalTypes'

interface Props {
  persona: PersonaKey
  year: number
  month: number
  today: number
  entries: EntriesMap
}

const PERSONA_CFG: Record<PersonaKey, { hue: number; label: string }> = {
  cartographer: { hue: 155, label: 'Cartographer' },
  tidekeeper: { hue: 255, label: 'Tidekeeper' },
  navigator: { hue: 35, label: 'Navigator' },
  voidwalker: { hue: 210, label: 'Voidwalker' },
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getIntensityLabel(intensity: number): string {
  if (intensity < 0.34) return 'Soft register'
  if (intensity < 0.67) return 'Steady presence'
  return 'High tide'
}

function makeArt(hue: number, emotion: string, intensity: number): string {
  const shift =
    (emotion.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 60) - 30

  const h = hue + shift
  const s = Math.round(22 + intensity * 16)
  const l = Math.round(48 + intensity * 18)
  const bgL = Math.max(10, l - 34)
  const o1 = (0.4 + intensity * 0.45).toFixed(2)
  const o2 = (0.18 + intensity * 0.25).toFixed(2)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94 94" style="width:100%;height:100%;display:block">` +
    `<rect width="94" height="94" fill="hsl(${h},${s}%,${bgL}%)"/>` +
    `<ellipse cx="${(26 + intensity * 12).toFixed(1)}" cy="${(24 + intensity * 8).toFixed(
      1
    )}" rx="${(26 + intensity * 13).toFixed(1)}" ry="${(20 + intensity * 10).toFixed(
      1
    )}" fill="hsl(${h},${s + 8}%,${l}%)" opacity="${o1}"/>` +
    `<ellipse cx="68" cy="64" rx="${(16 + intensity * 10).toFixed(1)}" ry="${(
      13 + intensity * 8
    ).toFixed(1)}" fill="hsl(${h + 18},${s}%,${l - 6}%)" opacity="${o2}"/>` +
    `<line x1="0" y1="${(38 - intensity * 4).toFixed(1)}" x2="94" y2="${(
      42 + intensity * 4
    ).toFixed(1)}" stroke="hsl(${h},${s}%,${l + 24}%)" stroke-width="0.5" opacity="0.15"/>` +
    `</svg>`
  )
}

export default function JournalGrid({
  persona,
  year,
  month,
  today,
  entries,
}: Props) {
  const { hue, label } = PERSONA_CFG[persona]

  const paper = '#7464a3'
  const paperSoft = '#9486c0'
  const ink = '#f6f1ff'
  const inkSoft = 'rgba(245, 239, 255, 0.84)'
  const green = '#94ffc5'
  const wood = '#30303a'
  const woodLight = '#3a3a47'

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = new Date(year, month, 1).getDay()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const [openSet, setOpenSet] = useState<Set<number>>(new Set())
  const [closing, setClosing] = useState<Set<number>>(new Set())
  const [detailDay, setDetailDay] = useState<number | null>(null)

  const clickTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const clickCounts = useRef<Record<number, number>>({})
  const pressTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const didLong = useRef<Record<number, boolean>>({})

  useEffect(() => {
    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-jcell]')) {
        setDetailDay(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [])

  function openDoor(day: number) {
    setClosing((prev) => {
      const next = new Set(prev)
      next.delete(day)
      return next
    })

    setOpenSet((prev) => {
      const next = new Set(prev)
      next.add(day)
      return next
    })
  }

  function closeDoor(day: number) {
    setOpenSet((prev) => {
      const next = new Set(prev)
      next.delete(day)
      return next
    })

    setDetailDay((prev) => (prev === day ? null : prev))

    setClosing((prev) => {
      const next = new Set(prev)
      next.add(day)
      return next
    })

    setTimeout(() => {
      setClosing((prev) => {
        const next = new Set(prev)
        next.delete(day)
        return next
      })
    }, 240)
  }

  function toggleDetail(day: number) {
    if (!openSet.has(day)) return
    setDetailDay((prev) => (prev === day ? null : day))
  }

  function handleArtTap(day: number) {
    if (didLong.current[day]) {
      didLong.current[day] = false
      return
    }

    clickCounts.current[day] = (clickCounts.current[day] ?? 0) + 1
    clearTimeout(clickTimers.current[day])

    clickTimers.current[day] = setTimeout(() => {
      const count = clickCounts.current[day] ?? 0
      clickCounts.current[day] = 0

      if (count >= 2) {
        toggleDetail(day)
      } else {
        if (!openSet.has(day)) return
        if (detailDay === day) setDetailDay(null)
        else closeDoor(day)
      }
    }, 220)
  }

  function startPress(day: number) {
    didLong.current[day] = false

    pressTimers.current[day] = setTimeout(() => {
      didLong.current[day] = true
      toggleDetail(day)
    }, 500)
  }

  function endPress(day: number) {
    clearTimeout(pressTimers.current[day])
  }

  const memoCopy = `Good things are happening. Leave space here for ${label.toLowerCase()} notes, tiny wins, and feelings that need a softer landing.`
  const plannerHint = 'Click a panel to open. Double-click or hold the artwork for detail.'

  return (
    <>
      <style>{`
        @keyframes jg-fade-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes jg-open {
          from { transform: perspective(340px) rotateY(0deg); }
          to { transform: perspective(340px) rotateY(-84deg); }
        }

        @keyframes jg-close {
          from { transform: perspective(340px) rotateY(-84deg); }
          to { transform: perspective(340px) rotateY(0deg); }
        }

        @keyframes jg-popup-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        .jg-paper {
          position: relative;
          width: min(980px, calc(100vw - 28px));
          margin: 0 auto;
          padding: clamp(18px, 2.6vw, 26px);
          border-radius: 28px;
          background:
            radial-gradient(circle at 12% 14%, rgba(255,255,255,0.14), transparent 24%),
            radial-gradient(circle at 88% 88%, rgba(255,255,255,0.1), transparent 20%),
            linear-gradient(180deg, ${paperSoft} 0%, ${paper} 100%);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow:
            0 18px 40px rgba(88, 71, 125, 0.24),
            inset 0 1px 0 rgba(255,255,255,0.14);
          overflow: visible;
          animation: jg-fade-in 0.6s cubic-bezier(.22,1,.36,1) both;
        }

        .jg-paper::before {
          content: '';
          position: absolute;
          inset: 12px;
          border-radius: 18px;
          pointer-events: none;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .jg-header {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .jg-header-copy,
        .jg-sticker-cluster,
        .jg-week-header,
        .jg-grid,
        .jg-memo {
          position: relative;
          z-index: 1;
        }

        .jg-header-copy {
          display: flex;
          flex-direction: column;
          gap: clamp(10px, 1.6vw, 14px);
          max-width: 34rem;
        }

        .jg-eyebrow,
        .jg-caption,
        .jg-hint,
        .jg-weekday,
        .jg-day-number,
        .jg-memo-label {
          font-family: 'Segoe Print', 'Bradley Hand', cursive;
        }

        .jg-eyebrow {
          margin: 0;
          font-family: 'Noto Serif Local', Georgia, serif;
          font-size: clamp(1.02rem, 1.3vw, 1.14rem);
          line-height: 1.3;
          color: ${inkSoft};
          letter-spacing: 0.02em;
        }

        .jg-month-line {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: clamp(8px, 1.4vw, 14px);
          margin-bottom: 0;
        }

        .jg-year {
          margin: 0;
          font-family: 'Noto Serif Local', Georgia, serif;
          font-size: clamp(3rem, 7vw, 4.6rem);
          font-weight: 700;
          line-height: 0.98;
          color: ${ink};
          letter-spacing: -0.05em;
          text-shadow: 0 1px 0 rgba(255,255,255,0.08);
        }

        .jg-subtitle {
          margin: 0;
          max-width: 26rem;
          font-size: clamp(0.98rem, 1.5vw, 1.12rem);
          line-height: 1.55;
          color: ${inkSoft};
        }

        .jg-caption-row {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          margin-bottom: 14px;
        }

        .jg-caption {
          margin: 0;
          font-size: 0.9rem;
          color: ${inkSoft};
        }

        .jg-hint {
          margin: 0;
          font-size: 0.88rem;
          text-align: right;
          color: ${inkSoft};
          font-style: italic;
        }

        .jg-sticker-cluster {
          display: grid;
          grid-template-columns: repeat(2, minmax(72px, 104px));
          gap: 10px;
          min-width: 226px;
          padding: 12px;
          border-radius: 18px;
          background: rgba(255,255,255,0.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 12px 24px rgba(75, 59, 115, 0.22);
        }

        .jg-sticker,
        .jg-sticker-wide {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.1);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            0 8px 16px rgba(73, 58, 111, 0.18);
        }

        .jg-sticker-wide {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 56px;
          font-family: var(--font-roboto), 'Helvetica Neue', Arial, sans-serif;
          font-size: clamp(1.6rem, 2vw, 1.9rem);
          font-weight: 700;
          letter-spacing: 0.05em;
          color: ${ink};
          background: rgba(255,255,255,0.12);
        }

        .jg-sticker {
          position: relative;
          min-height: 66px;
        }

        .jg-sticker--pink {
          transform: rotate(-4deg);
          background: rgba(237, 180, 213, 0.3);
        }

        .jg-sticker--blue {
          background: rgba(137, 169, 207, 0.28);
        }

        .jg-sticker--butter {
          background: rgba(245, 198, 168, 0.28);
        }

        .jg-sticker::before,
        .jg-sticker::after {
          content: '';
          position: absolute;
          border-radius: 999px;
        }

        .jg-sticker--pink::before {
          width: 18px;
          height: 18px;
          top: 14px;
          left: 14px;
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.34);
        }

        .jg-sticker--pink::after {
          width: 36px;
          height: 2px;
          right: 14px;
          bottom: 18px;
          background: rgba(255,255,255,0.78);
          box-shadow: 0 -8px 0 transparent;
        }

        .jg-sticker--blue::before {
          inset: 14px 18px 20px;
          border: 1.5px solid rgba(255,255,255,0.32);
          border-radius: 20px;
        }

        .jg-sticker--blue::after {
          width: 14px;
          height: 14px;
          right: 16px;
          top: 16px;
          background: ${green};
          box-shadow: 0 0 12px rgba(148,255,197,0.72);
        }

        .jg-sticker--butter::before {
          width: 42px;
          height: 42px;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.36);
        }

        .jg-sticker--butter::after {
          width: 22px;
          height: 2px;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.78);
        }

        .jg-week-header {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
          margin-top: 6px;
          margin-bottom: 8px;
        }

        .jg-weekday {
          min-height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-roboto), 'Helvetica Neue', Arial, sans-serif;
          font-size: clamp(0.95rem, 1.2vw, 1.08rem);
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #f6c4d7;
        }

        .jg-weekday--accent {
          color: #ffd8e2;
        }

        .jg-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          background: transparent;
        }

        .jg-cell {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(170, 151, 221, 0.34);
          overflow: visible;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 8px 16px rgba(74, 58, 112, 0.18);
          animation: jg-fade-in 0.56s cubic-bezier(.22,1,.36,1) both;
        }

        .jg-cell--blank {
          background: rgba(170, 151, 221, 0.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .jg-cell--today {
          box-shadow:
            inset 0 0 0 1px rgba(148,255,197,0.34),
            0 0 18px rgba(148,255,197,0.18),
            0 8px 16px rgba(74, 58, 112, 0.2);
        }

        .jg-day-number {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 4;
          font-size: clamp(1.3rem, 1.7vw, 1.55rem);
          line-height: 1;
          color: ${ink};
          pointer-events: none;
        }

        .jg-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          margin-left: 4px;
          border-radius: 999px;
          background: ${green};
          box-shadow: 0 0 0 4px rgba(148,255,197,0.16);
          vertical-align: middle;
        }

        .jg-art {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.16);
        }

        .jg-door {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          z-index: 3;
          cursor: pointer;
          overflow: hidden;
          transform-origin: left center;
          transform-style: preserve-3d;
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
          background: linear-gradient(180deg, ${woodLight} 0%, ${wood} 100%);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.06),
            inset 0 -12px 18px rgba(0,0,0,0.18),
            0 8px 14px rgba(56, 44, 87, 0.22);
        }

        .jg-door:hover {
          filter: brightness(1.04);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.06),
            inset 0 -12px 18px rgba(0,0,0,0.18),
            0 10px 18px rgba(56, 44, 87, 0.26);
        }

        .jg-door::after {
          content: '';
          position: absolute;
          inset: 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .jg-door-panel {
          position: absolute;
          inset: 8px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.04);
        }

        .jg-door-spine {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 8px;
          background: rgba(255,255,255,0.03);
          box-shadow: inset -1px 0 0 rgba(255,255,255,0.04);
        }

        .is-open .jg-door {
          animation: jg-open 0.22s cubic-bezier(.4,0,.2,1) forwards;
          pointer-events: none;
        }

        .is-close .jg-door {
          animation: jg-close 0.22s cubic-bezier(.4,0,.2,1) forwards;
        }

        .jg-popup {
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          width: 236px;
          z-index: 999;
          padding: 14px 14px 12px;
          border-radius: 18px;
          background: rgba(119, 103, 171, 0.96);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 20px 42px rgba(61, 48, 96, 0.34);
          transform: translateX(-50%);
          transform-origin: center bottom;
          pointer-events: auto;
          animation: jg-popup-in 0.18s cubic-bezier(.22,1,.36,1) forwards;
        }

        .jg-popup::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          width: 0;
          height: 0;
          transform: translateX(-50%);
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 10px solid rgba(119, 103, 171, 0.96);
        }

        .jg-popup-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.12);
          color: ${ink};
          cursor: pointer;
          line-height: 1;
        }

        .jg-popup-date {
          margin: 0 0 10px;
          font-family: 'Segoe Print', 'Bradley Hand', cursive;
          font-size: 0.85rem;
          color: ${inkSoft};
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .jg-popup-emotion {
          margin: 0 0 10px;
          font-family: 'Noto Serif Local', Georgia, serif;
          font-size: 1.42rem;
          line-height: 1.05;
          color: ${ink};
        }

        .jg-popup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .jg-popup-label,
        .jg-popup-note,
        .jg-tag {
          font-family: var(--font-roboto), sans-serif;
        }

        .jg-popup-label {
          font-size: 0.76rem;
          color: ${inkSoft};
        }

        .jg-popup-bar {
          min-width: 74px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
        }

        .jg-popup-bar > span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: ${green};
        }

        .jg-popup-note {
          margin: 0 0 12px;
          font-size: 0.82rem;
          line-height: 1.55;
          color: ${inkSoft};
        }

        .jg-popup-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .jg-tag {
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.08);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${ink};
        }

        .jg-memo {
          margin-top: 12px;
          min-height: 90px;
          padding: 16px 18px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          background: rgba(255,255,255,0.12);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.12),
            0 10px 18px rgba(74, 58, 112, 0.2);
        }

        .jg-memo-label {
          display: block;
          margin-bottom: 6px;
          font-size: 1.7rem;
          font-weight: 700;
          color: ${ink};
        }

        .jg-memo-text {
          margin: 0;
          max-width: 40rem;
          font-family: var(--font-roboto), sans-serif;
          font-size: 0.88rem;
          line-height: 1.5;
          color: ${inkSoft};
        }

        @media (prefers-reduced-motion: reduce) {
          .jg-paper,
          .jg-cell,
          .jg-popup,
          .is-open .jg-door,
          .is-close .jg-door {
            animation: none !important;
          }

          .jg-door {
            transition: none !important;
          }
        }

        @media (max-width: 900px) {
          .jg-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .jg-sticker-cluster {
            grid-template-columns: repeat(3, minmax(72px, 92px));
            min-width: 0;
          }

          .jg-sticker-wide {
            grid-column: 1 / 2;
            min-height: 52px;
          }
        }

        @media (max-width: 680px) {
          .jg-paper {
            width: calc(100vw - 18px);
            padding: 14px;
            border-radius: 24px;
          }

          .jg-year {
            font-size: 1.75rem;
          }

          .jg-caption-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .jg-caption,
          .jg-hint {
            text-align: left;
          }

          .jg-weekday {
            min-height: 22px;
            font-size: 0.96rem;
          }

          .jg-day-number {
            font-size: 0.98rem;
            top: 6px;
            left: 6px;
          }

          .jg-art,
          .jg-door {
            inset: 0;
            border-radius: 0;
          }

          .jg-popup {
            width: min(210px, calc(100vw - 24px));
            padding: 12px 12px 10px;
          }
        }
      `}</style>

      <section className="jg-paper">
        <header className="jg-header">
          <div className="jg-header-copy">
            <p className="jg-eyebrow">Aemona journal</p>

            <div className="jg-month-line">
              <p className="jg-year">
                {year} / {MONTH_NAMES[month]}
              </p>
            </div>

            <p className="jg-subtitle">
              A soft monthly planner for reflection, tiny checkpoints, and emotional residue.
            </p>
          </div>

          <div className="jg-sticker-cluster" aria-hidden="true">
            <div className="jg-sticker-wide">SPRING</div>
            <div className="jg-sticker jg-sticker--pink" />
            <div className="jg-sticker jg-sticker--blue" />
            <div className="jg-sticker jg-sticker--butter" />
          </div>
        </header>

        <div className="jg-caption-row">
          <p className="jg-caption">Illustration by Aemona archive.</p>
          <p className="jg-hint">{plannerHint}</p>
        </div>

        <div className="jg-week-header">
          {DOW.map((dayName, index) => (
            <div
              key={dayName}
              className={`jg-weekday ${index === 0 || index === 6 ? 'jg-weekday--accent' : ''}`}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="jg-grid">
          {Array.from({ length: totalCells }).map((_, index) => {
            const day = index - startOffset + 1
            const inMonth = day > 0 && day <= daysInMonth

            if (!inMonth) {
              return <div key={`blank-${index}`} className="jg-cell jg-cell--blank" />
            }

            const entry: JournalEntry | undefined = entries[day]
            const isFuture = day > today
            const isOpen = openSet.has(day)
            const isClose = closing.has(day)
            const isToday = day === today
            return (
              <div
                key={day}
                data-jcell={day}
                className={`jg-cell ${isOpen ? 'is-open' : isClose ? 'is-close' : ''} ${isToday ? 'jg-cell--today' : ''}`}
                style={{
                  opacity: entry && isFuture ? 0.35 : 1,
                  zIndex: detailDay === day ? 60 : isOpen ? 8 : 1,
                  animationDelay: `${index * 18}ms`,
                }}
              >
                <span
                  className="jg-day-number"
                  style={{
                    opacity: isOpen ? 0 : 1,
                    transition: 'opacity 0.18s ease',
                  }}
                >
                  {day}
                  {isToday && <span className="jg-dot" />}
                </span>

                {entry && !isFuture && (
                  <>
                    <div
                      className="jg-art"
                      onClick={() => handleArtTap(day)}
                      onMouseDown={() => startPress(day)}
                      onMouseUp={() => endPress(day)}
                      onMouseLeave={() => endPress(day)}
                      onTouchStart={(event) => {
                        event.preventDefault()
                        startPress(day)
                      }}
                      onTouchEnd={(event) => {
                        event.preventDefault()
                        endPress(day)
                        handleArtTap(day)
                      }}
                      onTouchMove={() => endPress(day)}
                    >
                      {entry.image ? (
                        <img
                          src={entry.image}
                          alt={entry.emotion}
                          draggable={false}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
                        />
                      ) : (
                        <div
                          dangerouslySetInnerHTML={{ __html: makeArt(hue, entry.emotion, entry.intensity) }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      )}
                    </div>

                    <div
                      className="jg-door"
                      onClick={() => {
                        if (!isOpen) openDoor(day)
                      }}
                    >
                      <span className="jg-door-spine" />
                      <span className="jg-door-panel" />
                    </div>

                    {detailDay === day && (
                      <div className="jg-popup" data-jcell={day}>
                        <button
                          type="button"
                          className="jg-popup-close"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDetailDay(null)
                          }}
                        >
                          x
                        </button>

                        <p className="jg-popup-date">
                          {MONTH_NAMES[month].slice(0, 3).toUpperCase()} {String(day).padStart(2, '0')}
                        </p>

                        <h3 className="jg-popup-emotion">{entry.emotion}</h3>

                        <div className="jg-popup-row">
                          <span className="jg-popup-label">
                            Intensity / {getIntensityLabel(entry.intensity)}
                          </span>
                          <div className="jg-popup-bar">
                            <span
                              style={{
                                width: `${Math.max(12, Math.round(entry.intensity * 100))}%`,
                              }}
                            />
                          </div>
                        </div>

                        {entry.note && <p className="jg-popup-note">{entry.note}</p>}

                        {entry.tags && entry.tags.length > 0 && (
                          <div className="jg-popup-tags">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="jg-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="jg-memo">
          <span className="jg-memo-label">Memo :</span>
          <p className="jg-memo-text">{memoCopy}</p>
        </div>
      </section>
    </>
  )
}
