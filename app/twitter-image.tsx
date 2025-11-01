import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'Chat with Docs - AI-Powered Document Assistant';
export const size = {
  width: 1200,
  height: 600,
};

export const contentType = 'image/png';

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A7CFF 0%, #47B5FF 100%)',
        }}
      >
        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
          }}
        >
          {/* Icon/Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              marginBottom: '30px',
              fontSize: '56px',
            }}
          >
            💬
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '64px',
              fontWeight: '800',
              color: 'white',
              textAlign: 'center',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}
          >
            Chat with Docs
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.9)',
              textAlign: 'center',
              marginBottom: '30px',
            }}
          >
            Upload documents, ask questions, get AI-powered answers
          </div>

          {/* Feature Pills */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {['📄 PDFs', '🤖 AI Powered', '⚡ Instant'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '100px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            display: 'flex',
            fontSize: '22px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          chat.yashwnthx.dev
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
