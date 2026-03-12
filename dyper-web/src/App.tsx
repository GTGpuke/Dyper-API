// Composant racine de l'application Dyper Web : structure plein écran avec en-tête et fenêtre de chat.
import { ChatWindow } from './components/Chat/ChatWindow'

export function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <header className="shrink-0 border-b border-gray-800 py-4 px-6 flex flex-col items-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Dyper
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Reconnaissance visuelle multimodale</p>
      </header>
      <main className="flex-1 overflow-hidden max-w-3xl mx-auto w-full">
        <ChatWindow />
      </main>
    </div>
  )
}
