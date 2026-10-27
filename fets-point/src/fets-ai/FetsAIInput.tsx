import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import './fets-ai-input.css';

/** Opens the existing assistant with an editable question; never sends automatically. */
export function FetsAIInput() {
  const [query, setQuery] = useState('');
  const open = (event: FormEvent) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('fets-open-ai', { detail: { query: query.trim() } }));
    setQuery('');
  };
  return <form className="fets-ai-input" onSubmit={open} role="search" aria-label="FETS AI">
    <Sparkles size={17} aria-hidden="true" />
    <input type="text" aria-label="Ask FETS AI" placeholder="Ask FETS AI" maxLength={4000}
      value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
    <button type="submit" aria-label="Open FETS AI assistant"><ArrowUpRight size={17} /></button>
  </form>;
}
