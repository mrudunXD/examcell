import React from 'react';

export default function ShinyText({ text, disabled = false, speed = 5, className = '', style = {} }) {
  const duration = `${speed}s`;
  
  if (disabled) {
    return <span className={className} style={style}>{text}</span>;
  }

  return (
    <span 
      className={`shiny-text ${className}`} 
      style={{ 
        animationDuration: duration,
        ...style
      }}
    >
      {text}
    </span>
  );
}
