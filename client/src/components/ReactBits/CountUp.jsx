import { useState, useEffect } from 'react';

export default function CountUp({ to, from = 0, duration = 1000, className = '', style = {} }) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(to);
      }
    };
    window.requestAnimationFrame(step);
  }, [to, from, duration]);

  return <span className={className} style={style}>{count}</span>;
}
