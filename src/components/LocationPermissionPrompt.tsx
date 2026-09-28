import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Shield, Check, X, Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { locationService, LocationContext } from '../lib/locationService';

interface LocationPermissionPromptProps {
  onPermissionGranted?: (context: LocationContext) => void;
  onDismiss?: () => void;
  inline?: boolean;
}

export function LocationPermissionPrompt({
  onPermissionGranted,
  onDismiss,
  inline = false
}: LocationPermissionPromptProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [cityInput, setCityInput] = useState(() => locationService.getManualCity());

  const handleGrantGPS = async () => {
    setIsRequesting(true);
    setErrorMsg(null);
    try {
      locationService.setPermissionPreference('auto');
      const result = await locationService.getCurrentLocation(8000);
      if (result.success && result.context) {
        window.dispatchEvent(new CustomEvent('alya:location-updated', { detail: result.context }));
        if (onPermissionGranted) onPermissionGranted(result.context);
        if (onDismiss) onDismiss();
      } else {
        setErrorMsg(result.error || 'Could not acquire GPS position. You can enter your city manually below.');
        setManualMode(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Location access was not granted.');
      setManualMode(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSaveManualCity = () => {
    if (!cityInput.trim()) return;
    locationService.setPermissionPreference('manual');
    locationService.setManualCity(cityInput.trim());
    const ctx = locationService.setUserLocationContext(cityInput.trim());
    window.dispatchEvent(new CustomEvent('alya:location-updated', { detail: ctx }));
    if (onPermissionGranted) onPermissionGranted(ctx);
    if (onDismiss) onDismiss();
  };

  const handleDecline = () => {
    locationService.setDismissedPrompt(true);
    locationService.setPermissionPreference('disabled');
    if (onDismiss) onDismiss();
  };

  const content = (
    <div className="p-4 md:p-5 rounded-3xl bg-slate-900/95 border border-indigo-500/30 text-white shadow-2xl backdrop-blur-md space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">Location Access Request</h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Private
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Alya needs location access to report real-time local weather, rainfall probabilities, and nearby places. Your coordinates are never stored or shared with external parties.
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={handleDecline}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {manualMode ? (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> Enter your City or Area
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="e.g. Kolkata, Delhi, London, Tokyo, Mumbai"
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveManualCity()}
            />
            <button
              onClick={handleSaveManualCity}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              Set City
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleGrantGPS}
              disabled={isRequesting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30"
            >
              {isRequesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              {isRequesting ? 'Acquiring GPS...' : 'Allow Location Access'}
            </button>
            <button
              onClick={() => setManualMode(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
            >
              Enter City Manually
            </button>
          </div>
          <button
            onClick={handleDecline}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div className="my-2">{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-[460px] z-50 shadow-2xl"
    >
      {content}
    </motion.div>
  );
}
