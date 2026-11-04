import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Multtek — Gestão de Expansão',description:'Seu time conectado. Cada tarefa no lugar certo.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
