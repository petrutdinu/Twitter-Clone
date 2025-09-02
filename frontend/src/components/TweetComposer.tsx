import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { tweetApi } from '../api/tweets';
import { useAuthStore } from '../store/auth';
import { useToast } from '../hooks/useToast';
import { Tweet, GifObject } from '../types';
import EmojiRenderer from './EmojiRenderer';
import HashtagText from './HashtagText';
import DefaultProfileIcon from './DefaultProfileIcon';
import GifPicker from './GifPicker';

interface TweetComposerProps {
  parentTweet?: Tweet;
  onReplySuccess?: () => void;
  onTweetSuccess?: () => void;
  placeholder?: string;
}

const TweetComposer: React.FC<TweetComposerProps> = ({ 
  parentTweet, 
  onReplySuccess, 
  onTweetSuccess,
  placeholder = "What's happening," 
}) => {
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState<GifObject | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { showToast } = useToast();

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    
    if (textarea) {
      const cursorPos = textarea.selectionStart || text.length;
      const newValue = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
      setText(newValue);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
    
    setShowEmojiPicker(false);
  };

  const createTweetMutation = useMutation({
    mutationFn: tweetApi.createTweet,
    onSuccess: (data) => {
      console.log('Tweet created successfully:', data);
      
      // Show success toast
      if (parentTweet) {
        showToast('Reply posted successfully!', 'success');
      } else {
        showToast('Tweet posted successfully!', 'success');
      }
      
      // Invalidate both tweets and timeline queries
      queryClient.invalidateQueries({ queryKey: ['tweets'] });
      queryClient.invalidateQueries({ queryKey: ['tweets', 'timeline'] });
      if (parentTweet) {
        // Also invalidate the specific tweet query if this is a reply
        queryClient.invalidateQueries({ queryKey: ['tweets', parentTweet.id] });
      }
      setText('');
      setMediaFiles([]);
      setShowPoll(false);
      setPollOptions(['', '']);
      // Call onReplySuccess if this is a reply, onTweetSuccess if it's a new tweet
      if (parentTweet && onReplySuccess) {
        onReplySuccess();
      } else if (!parentTweet && onTweetSuccess) {
        onTweetSuccess();
      }
    },
    onError: (error) => {
      console.error('Error creating tweet:', error);
      // Show error toast
      if (parentTweet) {
        showToast('Failed to post reply. Please try again.', 'error');
      } else {
        showToast('Failed to post tweet. Please try again.', 'error');
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    console.log('Submitting tweet with text:', text);
    console.log('Media files:', mediaFiles);
    console.log('Poll options:', pollOptions);

    const pollData = showPoll && pollOptions.filter(opt => opt.trim()).length >= 2
      ? { pollOptions: pollOptions.filter(opt => opt.trim()) }
      : {};

    try {
      await createTweetMutation.mutateAsync({
        text,
        mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
        parentId: parentTweet?.id,
        ...pollData,
      });
      
      console.log('Tweet posted successfully, refreshing timeline');
      
      // Force refetch after a short delay to ensure backend has processed the tweet
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tweets'] });
        queryClient.invalidateQueries({ queryKey: ['tweets', 'timeline'] });
        queryClient.refetchQueries({ queryKey: ['tweets', 'timeline'] });
      }, 500);
      
      setText('');
      setMediaFiles([]);
      setShowPoll(false);
      setPollOptions(['', '']);
    } catch (error) {
      console.error('Error creating tweet:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(prev => [...prev, ...files].slice(0, 4));
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions(prev => [...prev, '']);
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {parentTweet && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <EmojiRenderer text="💬" />
            <span>Replying to @{parentTweet.author.username}</span>
          </div>
          <div className="text-sm text-gray-700 line-clamp-2">
            <HashtagText text={parentTweet.text} />
          </div>
        </div>
      )}
      <div className="flex space-x-3">
        <div className="flex-shrink-0">
          {user?.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={`${user.username}'s avatar`}
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
              <DefaultProfileIcon size={20} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`${placeholder} ${user?.username}?`}
              className="form-textarea pr-12"
              rows={3}
              maxLength={280}
              required
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-3 top-3 p-1 rounded-md hover:bg-gray-100 transition-colors opacity-60 hover:opacity-100"
              title="Add emoji"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                <circle cx="9" cy="9" r="1" fill="currentColor"/>
                <circle cx="15" cy="9" r="1" fill="currentColor"/>
                <path strokeLinecap="round" strokeWidth="1.5" d="m9 16c.85.63 2.025 1 3 1s2.15-.37 3-1"/>
              </svg>
            </button>
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className={`absolute right-0 z-50 mt-2 ${
                parentTweet ? 'bottom-full mb-2' : 'top-full'
              }`}>
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={300}
                  height={400}
                />
              </div>
            )}
          </div>
          {/* Preview area showing hashtags in blue */}
          {text.trim() && (
            <div className="mt-2 p-2 bg-gray-50 rounded border text-sm">
              <div className="text-gray-500 text-xs mb-1">Preview:</div>
              <HashtagText text={text} className="whitespace-pre-wrap" />
            </div>
          )}
          <div className="text-right text-sm text-gray-500 mt-1">
            {text.length}/280
          </div>
        </div>
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {mediaFiles.map((file, index) => (
            <div key={index} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showPoll && (
        <div className="space-y-2">
          <h4 className="font-medium">Poll Options</h4>
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updatePollOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 form-input"
                maxLength={25}
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePollOption(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 4 && (
            <button
              type="button"
              onClick={addPollOption}
              className="text-primary hover:text-primary/80"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="cursor-pointer text-primary hover:text-primary/80 flex items-center space-x-1">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <EmojiRenderer text="📷" />
            <span>Media</span>
          </label>
          <button
            type="button"
            onClick={() => setShowPoll(!showPoll)}
            className="text-primary hover:text-primary/80 flex items-center space-x-1"
          >
            <EmojiRenderer text="📊" />
            <span>Poll</span>
          </button>
        </div>
        <button
          type="submit"
          disabled={!text.trim() || createTweetMutation.isPending}
          className="btn btn-primary"
        >
          {createTweetMutation.isPending 
            ? (parentTweet ? 'Replying...' : 'Posting...') 
            : (parentTweet ? 'Reply' : 'Post')
          }
        </button>
      </div>
    </form>
  );
};

export default TweetComposer;
