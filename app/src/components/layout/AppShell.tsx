import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { TopBar } from './TopBar'
import { CommandPalette } from '../shared/CommandPalette'

export function AppShell() {
  /*
    The palette's open state lives here because it has two doors — ⌘K, and the
    top bar's search box — and those two are siblings in this tree. One state
    between siblings needs no context and no store; the alternative is the top
    bar opening a second palette that doesn't know the first one exists.
  */
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <TopBar onOpenSearch={() => setPaletteOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
    </div>
  )
}
