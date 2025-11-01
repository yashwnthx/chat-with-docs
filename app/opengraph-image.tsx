import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'Chat with Docs - AI-Powered Document Assistant';
export const size = {
  width: 1200,
  height: 630,
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
            padding: '80px',
          }}
        >
          {/* Icon/Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '120px',
              height: '120px',
              borderRadius: '30px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              marginBottom: '40px',
              fontSize: '64px',
            }}
          >
            💬
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '72px',
              fontWeight: '800',
              color: 'white',
              textAlign: 'center',
              marginBottom: '20px',
              letterSpacing: '-0.02em',
            }}
          >
            Chat with Docs
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: 'flex',
              fontSize: '32px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.9)',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            AI-Powered Document Assistant
          </div>

          {/* Feature Pills */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {['Upload PDFs', 'Ask Questions', 'Get Instant Answers'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '100px',
                  fontSize: '20px',
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
            bottom: '40px',
            display: 'flex',
            fontSize: '24px',
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
