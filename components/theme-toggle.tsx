'use client';
import {useEffect, useState} from 'react';
import {Moon, Sun} from 'lucide-react';

export function ThemeToggle({className = ''}: {className?: string}) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('multtek-theme', next ? 'dark' : 'light'); } catch { /* The current tab still keeps the selected theme. */ }
  }
  return <button type="button" className={`theme-toggle ${className}`} onClick={toggle}
    aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-pressed={dark}
    title={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}>
    {dark ? <Sun size={16}/> : <Moon size={16}/>}<span>{dark ? 'Modo claro' : 'Modo escuro'}</span>
  </button>;
}
