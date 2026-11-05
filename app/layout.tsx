import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Multtek — Gestão de Expansão',description:'Seu time conectado. Cada tarefa no lugar certo.',icons:{icon:'/favicon.svg'}};
const themeScript = `try{var t=localStorage.getItem('multtek-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>}
