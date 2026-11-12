import { ReactNode, useEffect, useRef, useState } from "react";
import "./header.css";
function Icon({ name }: { name: "settings" | "about" | "more" | "quit" }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === "settings" ? <><path d="m9.5 3-.7 2.2-2 .9-2.1-.5-2.5 4.3 1.5 1.7v2.3l-1.5 1.6 2.5 4.3 2.2-.5 1.9 1 .7 2.1h5l.7-2.2 2-.9 2.1.5 2.5-4.3-1.5-1.7v-2.3l1.5-1.6-2.5-4.3-2.2.5-1.9-1L14.5 3z"/><circle cx="12" cy="12.5" r="3"/></>
      : name === "about" ? <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>
      : name === "quit" ? <><path d="M10 4H4v16h6m5-12 4 4-4 4m-7-4h11"/></>
      : <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>}
  </svg>;
}
export function AppHeader({ settings, onAbout, onQuit }: { settings: ReactNode; onAbout: () => void; onQuit: () => void }) {
  const [panel, setPanel] = useState<"settings" | "menu" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const settingsContent = useRef<HTMLDivElement>(null);
  const quitButton = useRef<HTMLButtonElement>(null);
  const closeSettings = () => { setPanel(null); settingsButton.current?.focus(); };
  useEffect(() => {
    if (panel === "settings") settingsContent.current?.querySelector<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')?.focus();
    if (panel === "menu") quitButton.current?.focus();
  }, [panel]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setPanel(null); };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel) { setPanel(null); (panel === "settings" ? settingsButton : menuButton).current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [panel]);
  return <header className="app-header">
    <span className="header-context">Football Manager 2024 <span className="header-local">Local scouting</span></span>
    <div className="header-actions" ref={root}>
      <button ref={settingsButton} className={"header-button" + (panel === "settings" ? " active" : "")} aria-expanded={panel === "settings"} aria-controls="settings-panel" onClick={() => setPanel(panel === "settings" ? null : "settings")}><Icon name="settings"/>Settings</button>
      <button className="header-button icon-button" title="About Foxy Scout" aria-label="About Foxy Scout" onClick={() => { setPanel(null); onAbout(); }}><Icon name="about"/></button>
      <button ref={menuButton} className="header-button icon-button" title="More app actions" aria-label="More app actions" aria-expanded={panel === "menu"} aria-controls="app-actions" onClick={() => setPanel(panel === "menu" ? null : "menu")}><Icon name="more"/></button>
      {panel === "settings" && <section id="settings-panel" className="header-panel settings-panel" aria-label="Settings">
        <div className="settings-panel-heading">
          <div><h2>Preferences</h2><p className="muted">Changes save automatically.</p></div>
          <button className="header-button icon-button settings-close" aria-label="Close settings" title="Close settings" onClick={closeSettings}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>
          </button>
        </div>
        <div ref={settingsContent} className="settings-panel-content">{settings}</div>
      </section>}
      {panel === "menu" && <div id="app-actions" className="header-panel app-actions"><button ref={quitButton} className="quit-action" onClick={() => { setPanel(null); onQuit(); }}><Icon name="quit"/>Quit Foxy Scout</button></div>}
    </div>
  </header>;
}
