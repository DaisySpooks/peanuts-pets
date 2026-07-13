import { useEffect, useId, useRef, useState } from 'react'
import { logout } from '../auth/discordAuth.js'
import { isAudioEnabled, toggleAudio } from '../lib/audio.js'

function useMobileAuthMenu({ onAdminClick }) {
  const [audioEnabled, setAudioEnabledState] = useState(() => isAudioEnabled())
  const [isOpen, setIsOpen] = useState(false)
  const menuRootRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!menuRootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const closeMenu = () => setIsOpen(false)

  const handleToggleAudio = () => {
    setAudioEnabledState(toggleAudio())
    closeMenu()
  }

  const handleLogout = () => {
    closeMenu()
    logout()
  }

  const handleAdminAction = () => {
    closeMenu()
    onAdminClick()
  }

  return {
    audioEnabled,
    handleAdminAction,
    handleLogout,
    handleToggleAudio,
    isOpen,
    menuId,
    menuRootRef,
    setIsOpen,
  }
}

function MobileAuthMenuItems({ audioEnabled, hasAdminAccess, onAdminClick, onLogout, onToggleAudio }) {
  const menuItemClassName =
    'w-full rounded-lg px-3 py-2 text-left text-sm text-cream transition hover:bg-[#26211c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60'

  return (
    <>
      <button type="button" role="menuitem" onClick={onToggleAudio} className={menuItemClassName}>
        {audioEnabled ? 'Sound Off' : 'Sound On'}
      </button>
      <button type="button" role="menuitem" onClick={onLogout} className={menuItemClassName}>
        Logout
      </button>
      {hasAdminAccess ? (
        <button type="button" role="menuitem" onClick={onAdminClick} className={menuItemClassName}>
          Admin
        </button>
      ) : null}
    </>
  )
}

function MenuTrigger({ isOpen, menuId, onToggle }) {
  return (
    <button
      type="button"
      aria-label="Open account menu"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={menuId}
      onClick={() => onToggle((open) => !open)}
      className="rounded-xl border border-gold/30 bg-[#171513] px-3 py-2 text-lg leading-none text-cream transition hover:border-gold/60 hover:bg-[#201c18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      ⋯
    </button>
  )
}

export function MobileFixedAuthMenu({ hasAdminAccess, onAdminClick }) {
  const {
    audioEnabled,
    handleAdminAction,
    handleLogout,
    handleToggleAudio,
    isOpen,
    menuId,
    menuRootRef,
    setIsOpen,
  } = useMobileAuthMenu({ onAdminClick })

  return (
    <div ref={menuRootRef} className="fixed right-4 top-4 z-50 md:hidden">
      <MenuTrigger isOpen={isOpen} menuId={menuId} onToggle={setIsOpen} />
      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full mt-2 min-w-[10rem] max-w-[calc(100vw-2rem)] rounded-xl border border-gold/30 bg-[#171513] p-1.5 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.9)]"
        >
          <MobileAuthMenuItems
            audioEnabled={audioEnabled}
            hasAdminAccess={hasAdminAccess}
            onAdminClick={handleAdminAction}
            onLogout={handleLogout}
            onToggleAudio={handleToggleAudio}
          />
        </div>
      ) : null}
    </div>
  )
}

export function MobileCardAuthMenu({ hasAdminAccess, onAdminClick }) {
  const {
    audioEnabled,
    handleAdminAction,
    handleLogout,
    handleToggleAudio,
    isOpen,
    menuId,
    menuRootRef,
    setIsOpen,
  } = useMobileAuthMenu({ onAdminClick })

  return (
    <div ref={menuRootRef} className="contents">
      <div className="absolute right-3.5 top-3 z-20">
        <MenuTrigger isOpen={isOpen} menuId={menuId} onToggle={setIsOpen} />
      </div>
      {isOpen ? (
        <div className="relative mt-3 flex justify-end">
          <div
            id={menuId}
            role="menu"
            className="w-full min-w-[10rem] max-w-[calc(100vw-4.5rem)] rounded-xl border border-gold/30 bg-[#171513] p-1.5 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.9)]"
          >
            <MobileAuthMenuItems
              audioEnabled={audioEnabled}
              hasAdminAccess={hasAdminAccess}
              onAdminClick={handleAdminAction}
              onLogout={handleLogout}
              onToggleAudio={handleToggleAudio}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
