import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { soundEffects } from '../utils/audio';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    soundEffects.playHapticClick();
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install FARISHTA App for Offline Desktop & Android Use"
        className={
          compact
            ? 'px-2 sm:px-2.5 py-1.5 rounded-full bg-[#4edea3]/15 border border-[#4edea3]/50 text-[#4edea3] hover:bg-[#4edea3]/25 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0'
            : 'flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00f1fd] to-[#4edea3] px-3.5 py-2 text-xs font-black text-[#002113] shadow-[0_0_16px_rgba(0,241,253,0.35)] hover:opacity-95 transition-all active:scale-95'
        }
      >
        <span className="material-symbols-outlined text-[15px] sm:text-[16px]">install_mobile</span>
        <span className={compact ? 'hidden md:inline' : ''}>
          {isInstallable ? 'Install App' : isIOS ? 'Add App' : 'Offline App'}
        </span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl bg-[#1c1f2a] border border-[#00f1fd]/40 p-5 sm:p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00f1fd]/20 text-[#00f1fd] flex items-center justify-center border border-[#00f1fd]/40 shrink-0">
                <span className="material-symbols-outlined text-[24px]">download_for_offline</span>
              </div>
              <div>
                <h3 className="font-display text-base font-black text-white">
                  Install FARISHTA Offline App
                </h3>
                <p className="text-[11px] text-[#4edea3] font-semibold">
                  Works on Chrome Desktop &amp; Android Offline
                </p>
              </div>
            </div>

            {isIOS ? (
              <p className="text-xs text-[#dfe2f1]/80 leading-relaxed space-y-2">
                <span className="block">1. Tap the <strong>Share</strong> icon in Safari toolbar.</span>
                <span className="block">2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                <span className="block">3. FARISHTA will launch full-screen with offline safety cache.</span>
              </p>
            ) : (
              <div className="text-xs text-[#dfe2f1]/80 leading-relaxed space-y-2">
                <p>
                  FARISHTA includes a registered Service Worker &amp; offline cache so your Doctors, Hospitals, Medical Card, and 4-Stage Crash Detector work even without internet.
                </p>
                <div className="p-3 rounded-xl bg-[#171b26] border border-[#262a35] space-y-1.5 text-[11px]">
                  <span className="font-bold text-[#00f1fd] block">Chrome Desktop / Android Steps:</span>
                  <span className="block">• <strong>Desktop Chrome:</strong> Click the Install icon in the address bar (or Menu ⋮ → <em>Save and Share → Install FARISHTA</em>).</span>
                  <span className="block">• <strong>Android Chrome:</strong> Tap Menu ⋮ → <em>Install app / Add to Home screen</em>.</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#00f1fd] text-[#00373a] font-display font-bold text-xs hover:opacity-90 transition-opacity"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] flex items-center gap-2 rounded-full bg-[#f59e0b] px-3.5 py-1.5 text-[11px] font-bold text-[#1c1000] shadow-lg">
      <span className="material-symbols-outlined text-[15px] shrink-0">cloud_off</span>
      <span className="truncate">Offline Mode — Local Cached Doctors, Hospitals &amp; Crash Shield Active</span>
    </div>
  );
};
