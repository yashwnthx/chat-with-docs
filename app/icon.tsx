import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #67FF81 0%, #01B41F 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '20%',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M43.5,75.7c2.1,0.3,4.2,0.5,6.4,0.5c18.2,0,33-12.3,33-27.4S68.2,21.5,50,21.5c-18.2,0-33,12.3-33,27.4c0,9.9,6.3,18.5,15.7,23.3c0,0.3,0,0.6,0,1c0,2.9-4.8,6.7-4.5,6.7c4.8,0,8.2-3,10.5-3.7C40.6,75.7,41.7,75.6,43.5,75.7z"
            fill="white"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
