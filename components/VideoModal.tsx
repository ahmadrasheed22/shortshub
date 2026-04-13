'use client';

import { useEffect } from 'react';

export default function VideoModal({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
      }}
      onClick={onClose}
    >
      {/* Container wrapper */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
          width: '100%',
          maxWidth: '380px',
        }}
      >
        {/* Close button — outside and above the player */}
        <button
          onClick={onClose}
          style={{
            position: 'relative',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '6px 10px',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.7)';
            e.currentTarget.style.color = 'rgba(255,255,255,1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
          }}
        >
          ✕
        </button>

        {/* Video player — separated from close button */}
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            aspectRatio: '9/16',
            maxHeight: '85vh',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#000',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* YouTube embed iframe */}
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
