import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 15, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else {
      // Use a small delay before calling onComplete to ensure the last character is rendered
      const timeout = setTimeout(() => {
        if (onComplete) onComplete();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-strong:font-bold prose-strong:text-inherit">
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
};
