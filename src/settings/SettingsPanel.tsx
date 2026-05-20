type Props = {
  doNotDisturb: boolean
  onDoNotDisturbChange: (value: boolean) => void
}

export function SettingsPanel({ doNotDisturb, onDoNotDisturbChange }: Props) {
  return (
    <section className="settings-panel">
      <h2>Settings</h2>
      <label className="setting-row">
        <span>
          <strong>Do not disturb</strong>
          <small>Suppress non-critical notifications while keeping session state visible.</small>
        </span>
        <input
          type="checkbox"
          checked={doNotDisturb}
          onChange={(event) => onDoNotDisturbChange(event.target.checked)}
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>Always on top pet window</strong>
          <small>Planned for the Tauri pet window after the MVP tray wiring lands.</small>
        </span>
        <input type="checkbox" defaultChecked disabled />
      </label>
    </section>
  )
}
