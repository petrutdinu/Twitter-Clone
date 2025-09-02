import React from 'react';

interface EmojiRendererProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const EmojiRenderer: React.FC<EmojiRendererProps> = ({ text, className = '', style }) => {
  // Safety check for empty or invalid text
  if (!text || typeof text !== 'string') {
    return <span className={className} style={style}></span>;
  }

  // Convert emoji to unicode codepoint for Twemoji CDN
  const getEmojiUrl = (emoji: string) => {
    try {
      // Get the full unicode codepoint sequence for the emoji
      const codePoints = [];
      for (let i = 0; i < emoji.length; ) {
        const codePoint = emoji.codePointAt(i);
        if (codePoint) {
          codePoints.push(codePoint.toString(16));
          i += codePoint > 0xFFFF ? 2 : 1;
        } else {
          i++;
        }
      }
      const codePointString = codePoints.join('-');
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${codePointString}.svg`;
    } catch (error) {
      console.warn('Error generating emoji URL for:', emoji, error);
      return '';
    }
  };

  // Simple but effective emoji regex
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝⭐🌟💫⚡🔥💥]/gu;

  // Process text and replace emojis with images
  const processText = (inputText: string) => {
    try {
      // First split by line breaks to handle multi-line text
      const lines = inputText.split('\n');
      
      const processedLines = lines.map((line, lineIndex) => {
        if (!line) {
          // Empty line, return a line break
          return <br key={`line-${lineIndex}`} />;
        }
        
        const parts = line.split(emojiRegex);
        const matches = line.match(emojiRegex) || [];
        
        const result = [];
        let matchIndex = 0;
        
        for (let i = 0; i < parts.length; i++) {
          // Add text part
          if (parts[i]) {
            result.push(parts[i]);
          }
          
          // Add emoji part if exists
          if (matchIndex < matches.length) {
            const emoji = matches[matchIndex];
            const emojiUrl = getEmojiUrl(emoji);
            
            if (emojiUrl) {
              result.push(
                <img
                  key={`emoji-${lineIndex}-${i}-${matchIndex}`}
                  src={emojiUrl}
                  alt={emoji}
                  className="emoji-twemoji"
                  style={{
                    height: '1.25em',
                    width: '1.25em',
                    verticalAlign: 'text-bottom',
                    display: 'inline-block',
                    margin: '0 0.05em',
                    ...style
                  }}
                  onError={(e) => {
                    console.log('Failed to load emoji:', emoji, 'URL:', emojiUrl);
                    // Fallback to native emoji
                    const target = e.target as HTMLImageElement;
                    const fallback = document.createElement('span');
                    fallback.textContent = emoji;
                    fallback.style.cssText = 'font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; font-size: 1.25em; vertical-align: text-bottom; display: inline-block;';
                    target.parentNode?.replaceChild(fallback, target);
                  }}
                />
              );
            } else {
              // If URL generation failed, use native emoji
              result.push(emoji);
            }
            matchIndex++;
          }
        }
        
        return result;
      });
      
      // Join lines with line breaks
      const finalResult = [];
      for (let i = 0; i < processedLines.length; i++) {
        const lineContent = processedLines[i];
        if (Array.isArray(lineContent)) {
          finalResult.push(...lineContent);
        } else {
          finalResult.push(lineContent);
        }
        // Add line break after each line except the last one
        if (i < processedLines.length - 1) {
          finalResult.push(<br key={`br-${i}`} />);
        }
      }
      
      return finalResult.length === 1 && typeof finalResult[0] === 'string' ? finalResult[0] : finalResult;
    } catch (error) {
      console.warn('Error processing emoji text:', inputText, error);
      return inputText; // Return original text if processing fails
    }
  };

  return (
    <span className={className} style={style}>
      {processText(text)}
    </span>
  );
};

export default EmojiRenderer;
