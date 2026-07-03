import { useState, useRef } from 'react';

export default function SpotlightCard({ children, className = '', style = {}, spotlightColor = 'rgba(109, 40, 217, 0.08)' }) {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div
      ref={cardRef}
      className={`card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      {isFocused && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 80%)`,
            zIndex: 1
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
