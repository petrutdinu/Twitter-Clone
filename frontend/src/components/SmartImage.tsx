import React, { useState, useEffect } from 'react';
import { tweetApi } from '../api/tweets';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
}

const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className }) => {
  const [imageUrl, setImageUrl] = useState<string>(src);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const loadImage = async () => {
      // If it's already a full URL (starts with http), try to use it first
      if (src.startsWith('http')) {
        // First, try to load the image directly
        const img = new Image();
        img.onload = () => {
          setImageUrl(src);
        };
        img.onerror = async () => {
          // If the image fails to load (e.g., expired signed URL), try to get a fresh one
          try {
            setLoading(true);
            
            // Extract S3 key from the URL
            let s3Key = '';
            if (src.includes('amazonaws.com/')) {
              // Extract key from S3 URL
              const urlParts = src.split('amazonaws.com/')[1];
              s3Key = urlParts.split('?')[0]; // Remove query parameters
            } else {
              throw new Error('Not an S3 URL');
            }
            
            const signedUrl = await tweetApi.getSignedMediaUrl(s3Key);
            setImageUrl(signedUrl);
          } catch (err) {
            console.error('Failed to get fresh signed URL for image:', err);
            setError(true);
          } finally {
            setLoading(false);
          }
        };
        img.src = src;
        return;
      }

      // If it's an S3 key, get signed URL
      try {
        setLoading(true);
        const signedUrl = await tweetApi.getSignedMediaUrl(src);
        setImageUrl(signedUrl);
      } catch (err) {
        console.error('Failed to get signed URL for image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [src]);

  if (loading) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};

export default SmartImage;
