import React from 'react';
import { useNavigate } from 'react-router-dom';
import EmojiRenderer from './EmojiRenderer';

interface HashtagTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const HashtagText: React.FC<HashtagTextProps> = ({ text, className = '', style }) => {
  const navigate = useNavigate();
  
  // Regex to match hashtags - word boundaries and alphanumeric characters
  const hashtagRegex = /(^|\s)(#[a-zA-Z0-9_]+)/g;
  
  const handleHashtagClick = (hashtag: string) => {
    // Remove the # symbol and navigate to hashtag page
    const cleanHashtag = hashtag.slice(1);
    navigate(`/hashtag/${cleanHashtag}`);
  };
  
  const processText = (inputText: string) => {
    // First process hashtags, then emojis
    const parts = inputText.split(hashtagRegex);
    
    return parts.map((part, index) => {
      // Check if this part is a hashtag
      if (part.match(/^#[a-zA-Z0-9_]+$/)) {
        return (
          <span 
            key={index} 
            className="text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleHashtagClick(part);
            }}
          >
            {part}
          </span>
        );
      }
      // For non-hashtag parts, process emojis
      return <EmojiRenderer key={index} text={part} />;
    });
  };

  return (
    <span className={className} style={style}>
      {processText(text)}
    </span>
  );
};

export default HashtagText;
