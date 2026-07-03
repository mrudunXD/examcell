import { useState, useEffect, useRef } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}|:<>?';

export default function DecryptedText({ text, speed = 40, maxIterations = 8, sequential = true, className = '', style = {} }) {
  const [displayText, setDisplayText] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    let iteration = 0;
    const targetText = text;
    const textLen = targetText.length;
    
    intervalRef.current = setInterval(() => {
      setDisplayText(() => {
        let output = '';
        for (let i = 0; i < textLen; i++) {
          if (targetText[i] === ' ') {
            output += ' ';
            continue;
          }
          if (sequential) {
            if (i < iteration / maxIterations) {
              output += targetText[i];
            } else {
              output += CHARS[Math.floor(Math.random() * CHARS.length)];
            }
          } else {
            if (Math.random() < iteration / (maxIterations * 2)) {
              output += targetText[i];
            } else {
              output += CHARS[Math.floor(Math.random() * CHARS.length)];
            }
          }
        }
        return output;
      });

      if (iteration >= textLen * maxIterations) {
        setDisplayText(targetText);
        clearInterval(intervalRef.current);
      }
      iteration++;
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [text, speed, maxIterations, sequential]);

  return (
    <span className={className} style={style}>
      {displayText}
    </span>
  );
}
