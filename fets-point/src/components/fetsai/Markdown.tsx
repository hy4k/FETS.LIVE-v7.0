import React from 'react'

/**
 * Compact markdown renderer for FETS AI replies (the agent answers in
 * markdown). Handles headings, bold/italic/code, bullet & numbered lists,
 * GFM pipe tables, and paragraphs — enough to render agent output cleanly
 * with high contrast. No external dependency.
 */

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Split on **bold**, *italic*, `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) nodes.push(<strong key={`${keyBase}-b${i}`} className="font-bold text-slate-900">{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) nodes.push(<code key={`${keyBase}-c${i}`} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-indigo-600 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>)
    else nodes.push(<em key={`${keyBase}-i${i}`} className="italic">{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function Table({ rows, k }: { rows: string[]; k: string }) {
  const parse = (line: string) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const header = parse(rows[0])
  const body = rows.slice(2).map(parse)
  return (
    <div className="my-2 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {header.map((h, i) => (
              <th key={`${k}-h${i}`} className="text-left font-bold text-slate-700 px-3 py-2 border-b border-slate-200">{renderInline(h, `${k}-h${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={`${k}-r${ri}`} className="odd:bg-white even:bg-slate-50/50">
              {r.map((c, ci) => (
                <td key={`${k}-r${ri}c${ci}`} className="px-3 py-2 border-b border-slate-100 text-slate-700">{renderInline(c, `${k}-r${ri}c${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // blank
    if (!trimmed) { i++; continue }

    // table: current line has pipes and next line is a separator
    if (/\|/.test(trimmed) && i + 1 < lines.length && /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
      const tbl: string[] = []
      while (i < lines.length && /\|/.test(lines[i])) { tbl.push(lines[i]); i++ }
      blocks.push(<Table key={`tbl${key++}`} rows={tbl} k={`tbl${key}`} />)
      continue
    }

    // headings
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const cls = level <= 1 ? 'text-lg font-black text-slate-900 mt-2'
        : level === 2 ? 'text-base font-bold text-slate-900 mt-2'
        : 'text-sm font-bold text-slate-800 mt-1'
      blocks.push(<div key={`h${key++}`} className={cls}>{renderInline(h[2], `h${key}`)}</div>)
      i++; continue
    }

    // list block (bullets or numbered)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: React.ReactNode[] = []
      const ordered = /^\s*\d+\.\s+/.test(line)
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')
        items.push(<li key={`li${key}-${i}`} className="text-slate-700 leading-relaxed">{renderInline(content, `li${key}-${i}`)}</li>)
        i++
      }
      blocks.push(
        ordered
          ? <ol key={`ol${key++}`} className="list-decimal ml-5 space-y-1 my-1">{items}</ol>
          : <ul key={`ul${key++}`} className="list-disc ml-5 space-y-1 my-1">{items}</ul>
      )
      continue
    }

    // paragraph (gather consecutive non-blank, non-special lines)
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.|#{1,4})\s+/.test(lines[i]) && !/\|/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    if (para.length) {
      blocks.push(<p key={`p${key++}`} className="text-slate-700 leading-relaxed">{renderInline(para.join(' '), `p${key}`)}</p>)
    } else { i++ }
  }

  return <div className="space-y-2">{blocks}</div>
}
