import { useEffect, useState } from "react";

/** Cycles through words in-place with a soft blur/fade swap. */
export function WordCycle({
  words,
  interval = 2200,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const swap = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI((v) => (v + 1) % words.length);
        setShow(true);
      }, 260);
    }, interval);
    return () => clearInterval(swap);
  }, [interval, words.length]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        show ? "opacity-100 blur-0 translate-y-0" : "opacity-0 blur-sm -translate-y-1"
      } ${className}`}
    >
      {words[i]}
    </span>
  );
}
