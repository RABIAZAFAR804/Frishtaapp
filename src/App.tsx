import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TabType,
  UserRoleMode,
  Responder,
  EmergencyService,
  RescueSystemConfig,
  EmergencyContact,
  NearbyHospital,
} from './types';
import { DEFAULT_RESCUE_CONFIG } from './data/emergencyServices';
import { loadEmergencyContacts, saveEmergencyContacts } from './data/initialContacts';
import { soundEffects } from './utils/audio';
import { useLocationAndNearby } from './hooks/useLocationAndNearby';
import { useAccidentSensors } from './hooks/useAccidentSensors';
import { useSmartDispatch } from './hooks/useSmartDispatch';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/PWAInstallButton';
import { MonitorView } from './components/MonitorView';
import { EmergencyView } from './components/EmergencyView';
import { RadarView } from './components/RadarView';
import { ServicesHubView } from './components/ServicesHubView';
import { MedicalCardView } from './components/MedicalCardView';
import { EmergencyContactsView } from './components/EmergencyContactsView';
import { SafetyHubView } from './components/safety-hub/SafetyHubView';
import { ArticleDetailView } from './components/safety-hub/ArticleDetailView';
import { ContactFormModal } from './components/ContactFormModal';
import { ContactPermissionModal } from './components/ContactPermissionModal';
import { PhoneContactsPickerModal } from './components/PhoneContactsPickerModal';
import { CallModal, RouteModal, WitnessModal } from './components/Modals';
import { RescueSystemManagerModal } from './components/RescueSystemManagerModal';

type CallOrRouteTarget = (Responder | EmergencyService) & {
  role?: string;
  affiliation?: string;
  badge?: string;
  avatarUrl?: string;
  icon?: string;
  color?: string;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('monitor');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRoleMode>('victim');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Sync tab and article details with URL path and hash
  useEffect(() => {
    const handleUrlRoute = () => {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const combined = (hash + ' ' + path).toLowerCase();

      if (combined.includes('safety-hub') || combined.includes('blog') || combined.includes('article-details')) {
        setActiveTab('safety-hub');
        // Extract possible article ID
        const raw = hash.replace(/^#\/?/, '').replace(/^blog\/?/, '').replace(/^safety-hub\/?/, '');
        if (raw && !raw.includes('/')) {
          setSelectedArticleId(raw);
        } else if (raw.includes('/')) {
          const segments = raw.split('/').filter(Boolean);
          if (segments.length > 0) {
            setSelectedArticleId(segments[segments.length - 1]);
          }
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('hashchange', handleUrlRoute);
    window.addEventListener('popstate', handleUrlRoute);
    return () => {
      window.removeEventListener('hashchange', handleUrlRoute);
      window.removeEventListener('popstate', handleUrlRoute);
    };
  }, []);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'safety-hub') {
      window.history.pushState(
        null,
        '',
        selectedArticleId ? `#/safety-hub/${selectedArticleId}` : '#/safety-hub'
      );
    } else {
      window.history.pushState(null, '', `/#/${tab}`);
    }
  };

  // Victim's Configured Rescue System (#1 1122 Locked, Secondary Replaceable, Nearest Hospital)
  const [rescueConfig, setRescueConfig] = useState<RescueSystemConfig>(DEFAULT_RESCUE_CONFIG);
  const [isRescueConfigModalOpen, setIsRescueConfigModalOpen] = useState(false);

  // Emergency Contacts state with local storage persistence
  const [contacts, setContacts] = useState<EmergencyContact[]>(loadEmergencyContacts);
  const [isContactFormModalOpen, setIsContactFormModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [isPhonePickerOpen, setIsPhonePickerOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [prefillContactData, setPrefillContactData] = useState<{ name: string; phone: string; relation: string } | null>(null);

  // Modals state
  const [activeCallTarget, setActiveCallTarget] = useState<CallOrRouteTarget | null>(null);
  const [activeRouteTarget, setActiveRouteTarget] = useState<CallOrRouteTarget | null>(null);
  const [isWitnessModalOpen, setIsWitnessModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [liveSpeedForNearby, setLiveSpeedForNearby] = useState(48);

  // Google Maps API key & Demo Key Two-Tier Quota Warning Banner state
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const lastAreaRef = useRef<string>('');

  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    if (mapsApiKey) return;
    fetch('/api/config/maps')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.apiKey) setMapsApiKey(data.apiKey);
      })
      .catch(() => {});
  }, [mapsApiKey]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const handleToggleMute = () => {
    const nextMute = !isAudioMuted;
    setIsAudioMuted(nextMute);
    soundEffects.isMuted = nextMute;
    if (!nextMute) {
      soundEffects.playHapticClick();
    }
  };

  const handleTriggerSOS = useCallback(() => {
    setIsEmergencyActive(true);
    setActiveTab('emergency');
    showToast('🚨 Severe Crash Triggered - 10s Autonomous CAD Buffer Engaged');
  }, [showToast]);

  // Live Area Detection, Nearest Doctors, Nearest Hospitals & 20-30 Min Predictive Alerts
  const {
    location,
    doctors,
    hospitals,
    predictiveWarning,
    isLoadingNearby,
    selectedPresetId,
    notificationPermission,
    detectLiveGPS,
    selectAreaPreset,
    requestAndSendPredictiveNotification,
  } = useLocationAndNearby(liveSpeedForNearby);

  // FARISHTA 4-Stage Smart Accident Detection System
  const {
    sensorState,
    setSpeedKmh,
    setGForce,
    setGyroAngleDeg,
    setPostImpactSpeedKmh,
    setSensorSource,
    enableHardwareSensors,
    evaluateNow,
    triggerFullFourStageCrashSimulation,
    resetSensorsToNormal,
  } = useAccidentSensors(autoDetectEnabled, location.lat, location.lng, handleTriggerSOS);

  const {
    candidateTeams,
    dispatchCase,
    isCoordinating,
    toggleTeamAvailability,
    runSmartDispatch,
    confirmArrival,
    resetDispatch,
  } = useSmartDispatch(location);

  useEffect(() => {
    setLiveSpeedForNearby(sensorState.speedKmh);
  }, [sensorState.speedKmh]);

  // Automatically sync nearest GPS-sorted hospital when detected area changes
  useEffect(() => {
    if (hospitals.length === 0) return;
    const areaKey = `${location.areaName}:${hospitals[0]?.id}`;
    if (areaKey === lastAreaRef.current) return;
    lastAreaRef.current = areaKey;
    setRescueConfig((prev) => ({
      ...prev,
      targetHospital: hospitals[0],
    }));
  }, [location.areaName, hospitals]);

  const handleSelectTargetHospital = (hosp: NearbyHospital) => {
    setRescueConfig((prev) => ({
      ...prev,
      targetHospital: hosp,
    }));
    showToast(`🏥 Target ER updated to nearest hospital: ${hosp.name} (${hosp.distance})`);
  };

  const handleSendPredictiveAlert = async () => {
    soundEffects.playEmergencyBeep();
    const sentOS = await requestAndSendPredictiveNotification();
    if (predictiveWarning) {
      showToast(
        sentOS
          ? `🔔 Push Alert Sent (${predictiveWarning.leadTimeMinutes}m ahead): ${predictiveWarning.zoneName}`
          : `⚠️ ${predictiveWarning.leadTimeMinutes} Min Early Alert: ${predictiveWarning.title}`
      );
    }
  };

  const handleCancelEmergency = () => {
    setIsEmergencyActive(false);
    resetDispatch();
    setActiveTab('monitor');
    showToast('✓ Autonomous CAD Dispatch Aborted. Standby Active.');
  };

  const triggerCoordinatedDispatch = useCallback(
    async (customSeverity?: number) => {
      const result = await runSmartDispatch({
        gForce: sensorState.gForce,
        speedKmh: sensorState.speedKmh,
        severityScore: customSeverity ?? sensorState.severityScore,
        targetHospitalName: rescueConfig.targetHospital.name,
        contacts,
      });
      setIsEmergencyActive(true);
      setActiveTab('radar');
      showToast(
        `🚑 ${result.assignedTeam.name} dispatched (${result.assignedTeam.eta}) • ${result.otherTeams.length} other teams stood down!`
      );
    },
    [
      runSmartDispatch,
      sensorState.gForce,
      sensorState.speedKmh,
      sensorState.severityScore,
      rescueConfig.targetHospital.name,
      contacts,
      showToast,
    ]
  );

  const handleDispatchConfirmed = () => {
    triggerCoordinatedDispatch();
  };

  const handleWitnessSubmit = (details: { casualties: string; severity: string; notes: string }) => {
    setIsWitnessModalOpen(false);
    triggerCoordinatedDispatch(details.severity.includes('Critical') ? 92 : 74);
  };

  const handleSmartDispatchFromHub = () => {
    triggerCoordinatedDispatch();
  };

  const handleConfirmTeamArrival = async () => {
    await confirmArrival();
    soundEffects.playSuccessDispatch();
    showToast('✓ Rescue Team Arrival Confirmed on Scene • Family Contacts Notified!');
  };

  // Contacts handlers
  const handleSaveContact = (savedContact: EmergencyContact) => {
    setContacts((prev) => {
      const existsIndex = prev.findIndex((c) => c.id === savedContact.id);
      let updated: EmergencyContact[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = savedContact;
      } else {
        if (savedContact.isPrimary) {
          prev = prev.map((c) => ({ ...c, isPrimary: false }));
        }
        updated = [savedContact, ...prev];
      }

      if (savedContact.isPrimary) {
        updated = updated.map((c) =>
          c.id === savedContact.id ? { ...c, isPrimary: true } : { ...c, isPrimary: false }
        );
      }

      saveEmergencyContacts(updated);
      return updated;
    });

    setIsContactFormModalOpen(false);
    setEditingContact(null);
    setPrefillContactData(null);
    showToast(`✓ Emergency Lifeline Saved: ${savedContact.name} (${savedContact.relation})`);
  };

  const handleDeleteContact = (contactId: string) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== contactId);
      saveEmergencyContacts(updated);
      return updated;
    });
  };

  const handleToggleContactAlert = (contactId: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id === contactId) {
          const nextState = c.enabledAlert === false;
          showToast(nextState ? `✓ Crash GPS Alert ENABLED for ${c.name}` : `Crash Alert MUTED for ${c.name}`);
          return { ...c, enabledAlert: nextState };
        }
        return c;
      });
      saveEmergencyContacts(updated);
      return updated;
    });
  };

  const handleOpenAddContactModal = () => {
    setEditingContact(null);
    setPrefillContactData(null);
    setIsContactFormModalOpen(true);
  };

  const handleOpenEditContactModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setPrefillContactData(null);
    setIsContactFormModalOpen(true);
  };

  const handleClearAllContacts = () => {
    setContacts([]);
    saveEmergencyContacts([]);
    showToast('✓ All temporary emergency contacts cleared');
  };

  // Check if browser native Contact Picker API is available
  const isNativePickerSupported =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window &&
    'select' in (navigator as any).contacts;

  const triggerContactSelection = async () => {
    if (isNativePickerSupported) {
      try {
        const props = ['name', 'tel'];
        const selected = await (navigator as any).contacts.select(props, { multiple: false });
        if (selected && selected.length > 0 && selected[0]) {
          const picked = selected[0];
          const rawName = picked.name?.[0] || 'Phone Contact';
          const rawTel = picked.tel?.[0] || '';
          setPrefillContactData({
            name: rawName,
            phone: rawTel,
            relation: 'Family',
          });
          setEditingContact(null);
          setIsContactFormModalOpen(true);
          showToast(`✓ Selected ${rawName} directly from device contacts`);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Native picker error:', err);
      }
    }
    setIsPhonePickerOpen(true);
  };

  const handleChooseFromPhone = async () => {
    // Directly launch phone contact picker if supported by mobile browser
    if (isNativePickerSupported) {
      await triggerContactSelection();
    } else {
      setIsPhonePickerOpen(true);
    }
  };

  const handleGrantPermission = () => {
    setIsPermissionModalOpen(false);
    triggerContactSelection();
  };

  const handleDenyPermission = () => {
    setIsPermissionModalOpen(false);
    handleOpenAddContactModal();
  };

  const handleSelectFromPhoneBook = (data: { name: string; phone: string; relation: string }) => {
    setPrefillContactData(data);
    setEditingContact(null);
    setIsPhonePickerOpen(false);
    setIsContactFormModalOpen(true);
    showToast(`✓ Selected ${data.name}. Review details and save.`);
  };

  return (
    <div className="min-h-screen bg-[#0D0D11] text-[#dfe2f1] flex flex-col justify-between selection:bg-[#ff334b] selection:text-white relative overflow-x-hidden">
      {/* Demo Key Quota Exceeded Top Warning Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Tactical Top Bar */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onTriggerSOS={handleTriggerSOS}
        isAudioMuted={isAudioMuted}
        onToggleMute={handleToggleMute}
        isEmergencyActive={isEmergencyActive}
        contactsCount={contacts.filter((c) => c.enabledAlert !== false).length}
      />

      {/* Main Screen Router */}
      <main className="flex-1 w-full pt-18 pb-24 lg:pb-10">
        {activeTab === 'monitor' && (
          <MonitorView
            userRole={userRole}
            rescueConfig={rescueConfig}
            contacts={contacts}
            autoDetectEnabled={autoDetectEnabled}
            onToggleAutoDetect={setAutoDetectEnabled}
            location={location}
            doctors={doctors}
            hospitals={hospitals}
            predictiveWarning={predictiveWarning}
            isLoadingNearby={isLoadingNearby}
            selectedPresetId={selectedPresetId}
            notificationPermission={notificationPermission}
            sensorState={sensorState}
            onChangeSpeed={setSpeedKmh}
            onChangeGForce={setGForce}
            onChangeGyroAngle={setGyroAngleDeg}
            onChangePostSpeed={setPostImpactSpeedKmh}
            onEnableHardware={enableHardwareSensors}
            onUseSimulator={() => setSensorSource('simulator')}
            onEvaluateSensors={evaluateNow}
            onSimulateFullCrash={triggerFullFourStageCrashSimulation}
            onResetSensors={resetSensorsToNormal}
            onSendPredictiveNotification={handleSendPredictiveAlert}
            onSelectPreset={selectAreaPreset}
            onRefreshGPS={detectLiveGPS}
            onSelectTargetHospital={handleSelectTargetHospital}
            onOpenServiceCall={(service) => setActiveCallTarget(service)}
            onOpenServiceRoute={(service) => setActiveRouteTarget(service)}
            onOpenRescueConfigModal={() => setIsRescueConfigModalOpen(true)}
            onOpenContactsTab={() => handleSelectTab('contacts')}
            onOpenSafetyHub={() => {
              setSelectedArticleId(null);
              handleSelectTab('safety-hub');
            }}
            onAddContact={handleOpenAddContactModal}
            onToggleUserRole={setUserRole}
            onTriggerEmergency={handleTriggerSOS}
            onOpenWitnessModal={() => setIsWitnessModalOpen(true)}
            mapsApiKey={mapsApiKey}
            dispatchCase={dispatchCase}
            candidateTeams={candidateTeams}
            isCoordinating={isCoordinating}
            onTriggerSmartDispatch={handleSmartDispatchFromHub}
            onConfirmArrival={handleConfirmTeamArrival}
            onToggleTeamAvailability={toggleTeamAvailability}
            onResetDispatch={resetDispatch}
          />
        )}

        {activeTab === 'safety-hub' &&
          (selectedArticleId ? (
            <ArticleDetailView
              articleId={selectedArticleId}
              onBack={() => {
                setSelectedArticleId(null);
                window.history.pushState(null, '', '#/safety-hub');
              }}
              onSelectRelatedArticle={(id) => {
                setSelectedArticleId(id);
                window.history.pushState(null, '', `#/safety-hub/${id}`);
              }}
              onTriggerSOS={handleTriggerSOS}
            />
          ) : (
            <SafetyHubView
              onSelectArticle={(id) => {
                setSelectedArticleId(id);
                window.history.pushState(null, '', `#/safety-hub/${id}`);
              }}
              onOpen1122Call={() => {
                showToast('📞 Connecting to Rescue 1122 Emergency Dispatch...');
              }}
            />
          ))}

        {activeTab === 'contacts' && (
          <EmergencyContactsView
            contacts={contacts}
            onAddContact={handleOpenAddContactModal}
            onEditContact={handleOpenEditContactModal}
            onDeleteContact={handleDeleteContact}
            onClearAllContacts={handleClearAllContacts}
            onToggleAlert={handleToggleContactAlert}
            onChooseFromPhone={handleChooseFromPhone}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'emergency' && (
          <EmergencyView
            rescueConfig={rescueConfig}
            contacts={contacts}
            location={location}
            candidateTeams={candidateTeams}
            gForce={sensorState.gForce}
            speedKmh={sensorState.speedKmh}
            onCancelEmergency={() => {
              resetSensorsToNormal();
              handleCancelEmergency();
            }}
            onDispatchConfirmed={handleDispatchConfirmed}
            isAudioMuted={isAudioMuted}
          />
        )}

        {activeTab === 'radar' && (
          <RadarView
            contacts={contacts}
            location={location}
            doctors={doctors}
            hospitals={hospitals}
            selectedHospitalId={rescueConfig.targetHospital.id}
            mapsApiKey={mapsApiKey}
            isEmergencyActive={isEmergencyActive || sensorState.crashDetected}
            dispatchCase={dispatchCase}
            candidateTeams={candidateTeams}
            isCoordinating={isCoordinating}
            onTriggerSmartDispatch={handleSmartDispatchFromHub}
            onConfirmArrival={handleConfirmTeamArrival}
            onToggleTeamAvailability={toggleTeamAvailability}
            onResetDispatch={resetDispatch}
            onSelectTargetHospital={handleSelectTargetHospital}
            onOpenCall={(responder) => setActiveCallTarget(responder)}
            onOpenRoute={(responder) => setActiveRouteTarget(responder)}
            onOpenServiceCall={(service) => setActiveCallTarget(service)}
            onOpenServiceRoute={(service) => setActiveRouteTarget(service)}
          />
        )}

        {activeTab === 'services' && (
          <ServicesHubView
            rescueConfig={rescueConfig}
            contacts={contacts}
            location={location}
            doctors={doctors}
            hospitals={hospitals}
            isLoadingNearby={isLoadingNearby}
            selectedPresetId={selectedPresetId}
            dispatchCase={dispatchCase}
            candidateTeams={candidateTeams}
            isCoordinating={isCoordinating}
            onToggleTeamAvailability={toggleTeamAvailability}
            onConfirmArrival={handleConfirmTeamArrival}
            onResetDispatch={resetDispatch}
            onSelectPreset={selectAreaPreset}
            onRefreshGPS={detectLiveGPS}
            onSelectTargetHospital={handleSelectTargetHospital}
            onOpenRescueConfigModal={() => setIsRescueConfigModalOpen(true)}
            onOpenServiceRoute={(service) => setActiveRouteTarget(service)}
            onOpenServiceCall={(service) => setActiveCallTarget(service)}
            onBroadcastAllServices={handleSmartDispatchFromHub}
          />
        )}

        {activeTab === 'medical' && (
          <MedicalCardView
            contacts={contacts}
            onAddContact={handleOpenAddContactModal}
            onEditContact={handleOpenEditContactModal}
            onDeleteContact={handleDeleteContact}
            onChooseFromPhone={handleChooseFromPhone}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Floating System Micro-Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1f2a] border border-[#00f1fd]/50 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-md text-center animate-in slide-in-from-top duration-200">
          <span className="material-symbols-outlined text-[16px] text-[#00f1fd] shrink-0">info</span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Interactive Modals */}
      <CallModal
        target={activeCallTarget}
        onClose={() => setActiveCallTarget(null)}
      />

      <RouteModal
        target={activeRouteTarget}
        onClose={() => setActiveRouteTarget(null)}
      />

      <WitnessModal
        isOpen={isWitnessModalOpen}
        onClose={() => setIsWitnessModalOpen(false)}
        onSubmit={handleWitnessSubmit}
      />

      {/* Victim's Rescue System & Nearest Hospital Manager Modal */}
      <RescueSystemManagerModal
        isOpen={isRescueConfigModalOpen}
        onClose={() => setIsRescueConfigModalOpen(false)}
        config={rescueConfig}
        onSaveConfig={(newConfig) => {
          setRescueConfig(newConfig);
          showToast(`✓ Rescue Updated: #1 1122 (Fixed) + #2 ${newConfig.secondarySystem.name} • Destination: ${newConfig.targetHospital.name}`);
        }}
      />

      {/* Contact Form Modal (Add / Edit) */}
      <ContactFormModal
        isOpen={isContactFormModalOpen}
        onClose={() => {
          setIsContactFormModalOpen(false);
          setEditingContact(null);
          setPrefillContactData(null);
        }}
        onSave={handleSaveContact}
        editingContact={editingContact}
        onOpenPhonePicker={handleChooseFromPhone}
        prefillData={prefillContactData}
      />

      {/* Contact Permission Modal */}
      <ContactPermissionModal
        isOpen={isPermissionModalOpen}
        onGrantPermission={handleGrantPermission}
        onDenyPermission={handleDenyPermission}
      />

      {/* Phone Contacts Picker Modal */}
      <PhoneContactsPickerModal
        isOpen={isPhonePickerOpen}
        onClose={() => setIsPhonePickerOpen(false)}
        onSelectContact={handleSelectFromPhoneBook}
        onTriggerNativePicker={triggerContactSelection}
        isNativePickerSupported={Boolean(isNativePickerSupported)}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Bottom Sticky Tab Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isEmergencyActive={isEmergencyActive}
        contactsCount={contacts.filter((c) => c.enabledAlert !== false).length}
      />
    </div>
  );
}
