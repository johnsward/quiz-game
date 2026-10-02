interface StampProps {
  isTrue: boolean;
}

/** The rubber stamp that slams onto a claim once it's answered. */
export function Stamp({ isTrue }: StampProps) {
  return (
    <span className={isTrue ? 'stamp stamp--true' : 'stamp stamp--fake'} aria-hidden="true">
      {isTrue ? 'True' : 'Fake'}
    </span>
  );
}
