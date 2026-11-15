"use client";
// Drawn when a component cannot be loaded: a rounded pale-mint block with the component's name.
// A placeholder for a component with exactly one out trigger fires it when tapped, so a flow still works.

export function RivePlaceholder({ name, onTap }: { name: string; onTap?: () => void }) {
  if (onTap) {
    return (
      <button type="button" className="sisu-rive-placeholder" onClick={onTap} aria-label={name}>
        <span className="sisu-rive-placeholder-name">{name}</span>
      </button>
    );
  }
  return (
    <div className="sisu-rive-placeholder" role="img" aria-label={name}>
      <span className="sisu-rive-placeholder-name">{name}</span>
    </div>
  );
}
