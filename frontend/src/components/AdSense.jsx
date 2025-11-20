// frontend/src/components/AdSense.jsx
import React, { useEffect, useRef } from 'react';

const AdSense = ({ adSlot, adFormat = 'auto', style = {} }) => {
  const adRef = useRef(null);
  const adLoaded = useRef(false);

  useEffect(() => {
    // Only load ads if we have a slot ID and haven't loaded yet
    if (!adSlot || adLoaded.current) return;

    // Function to push ad
    const pushAd = () => {
      try {
        if (window.adsbygoogle && !adLoaded.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          adLoaded.current = true;
        }
      } catch (e) {
        console.error('AdSense error:', e);
      }
    };

    // Check if adsbygoogle script is loaded
    if (window.adsbygoogle) {
      pushAd();
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
          console.warn('AdSense script not loaded after 10 seconds');
        }
      }, 10000);
    }
  }, [adSlot]);

  // Don't render if no ad slot
  if (!adSlot || adSlot === '1234567890' || adSlot === '0987654321') {
    return null; // Don't show placeholder ads
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
        data-ad-client={process.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-XXXXXXXXXX'}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="false"
      />
    </div>
  );
};

export default AdSense;

