// frontend/src/components/AdSense.jsx
import React, { useEffect, useRef } from 'react';

const AdSense = ({ adSlot, adFormat = 'auto', style = {} }) => {
  const adRef = useRef(null);
  const adLoaded = useRef(false);

  useEffect(() => {
    // Check if we have valid ad slot
    if (!adSlot || adSlot === '1234567890' || adSlot === '0987654321') {
      console.warn('AdSense: No valid ad slot provided. Set VITE_ADSENSE_LEFT_SLOT and VITE_ADSENSE_RIGHT_SLOT environment variables.');
      return;
    }

    // Check if already loaded
    if (adLoaded.current) return;

    // Function to push ad
    const pushAd = () => {
      try {
        if (window.adsbygoogle && adRef.current && !adLoaded.current) {
          console.log('AdSense: Pushing ad for slot:', adSlot);
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          adLoaded.current = true;
        }
      } catch (e) {
        console.error('AdSense error:', e);
      }
    };

    // Check if adsbygoogle script is loaded
    if (window.adsbygoogle) {
      // Small delay to ensure DOM is ready
      setTimeout(pushAd, 100);
    } else {
      // Wait for adsbygoogle to be available
      const checkAds = setInterval(() => {
        if (window.adsbygoogle) {
          pushAd();
          clearInterval(checkAds);
        }
      }, 100);

      // Cleanup after 10 seconds
      setTimeout(() => {
        clearInterval(checkAds);
        if (!adLoaded.current) {
          console.warn('AdSense: Script not loaded. Check if AdSense script is in index.html');
        }
      }, 10000);
    }
  }, [adSlot]);

  // Show debug info if no valid slot
  if (!adSlot || adSlot === '1234567890' || adSlot === '0987654321') {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div style={{
          minWidth: '160px',
          minHeight: '600px',
          border: '2px dashed #666',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: '12px',
          textAlign: 'center',
          padding: '10px',
          ...style
        }}>
          Ad Slot Placeholder<br/>
          Set VITE_ADSENSE_LEFT_SLOT<br/>
          or VITE_ADSENSE_RIGHT_SLOT
        </div>
      );
    }
    return null;
  }

  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-XXXXXXXXXX';
  
  if (clientId === 'ca-pub-XXXXXXXXXX') {
    console.warn('AdSense: Client ID not set. Set VITE_ADSENSE_CLIENT_ID environment variable.');
  }

  return (
    <div 
      ref={adRef}
      style={{
        minWidth: '160px',
        minHeight: '600px',
        ...style
      }}
      className="adsense-container"
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '160px',
          minHeight: '600px'
        }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="false"
      />
    </div>
  );
};

export default AdSense;

