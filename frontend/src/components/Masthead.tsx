interface MastheadProps {
  /** Right-hand dateline text, e.g. the current claim number. */
  dateline?: string;
  /** Compact masthead for in-game screens. */
  compact?: boolean;
}

export function Masthead({ dateline = 'Daily Edition', compact = false }: MastheadProps) {
  return (
    <header className={compact ? 'masthead masthead--compact' : 'masthead'}>
      <div className="masthead__meta">
        <span>The Quiz Desk</span>
        <span>{dateline}</span>
      </div>
      <h1 className="masthead__title">Absurdly True?</h1>
    </header>
  );
}
