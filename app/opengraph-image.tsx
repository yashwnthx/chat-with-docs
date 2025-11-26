import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'Didi Sakhi';
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
          background: 'linear-gradient(135deg, #67FF81 0%, #01B41F 100%)',
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
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M43.5,75.7c2.1,0.3,4.2,0.5,6.4,0.5c18.2,0,33-12.3,33-27.4S68.2,21.5,50,21.5c-18.2,0-33,12.3-33,27.4c0,9.9,6.3,18.5,15.7,23.3c0,0.3,0,0.6,0,1c0,2.9-4.8,6.7-4.5,6.7c4.8,0,8.2-3,10.5-3.7C40.6,75.7,41.7,75.6,43.5,75.7z"
                fill="white"
              />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '72px',
              fontWeight: '800',
              color: 'white',
              textAlign: 'center',
              letterSpacing: '-0.02em',
            }}
          >
            Didi Sakhi
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
          didisakhi.diu.one
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
