import { useState, useEffect, useCallback } from "react";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, app } from "../firebase";

export interface WebNotification {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  data?: any;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<WebNotification[]>([]);
  const [hasUserGesture, setHasUserGesture] = useState(false);

  // Monitor user gestures to unlock audio playback according to browser autoplay policy
  useEffect(() => {
    const handleGesture = () => {
      setHasUserGesture(true);
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };

    window.addEventListener("click", handleGesture);
    window.addEventListener("keydown", handleGesture);
    window.addEventListener("touchstart", handleGesture);

    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
  }, []);

  // Custom audio alert play (plays local file sounds/alert.mp3 or synthesizes a premium digital chime)
  const playAlertSound = useCallback(async () => {
    try {
      // 1. Try playing custom local public audio alert
      const audio = new Audio("/sounds/alert.mp3");
      audio.volume = 0.85;
      await audio.play();
      console.log("Played local notification alert sound successfully.");
    } catch (err) {
      console.warn("Playing `/sounds/alert.mp3` was blocked/unavailable, fallback to real-time Web Audio API synth:", err);
      // 2. Synthesize a professional double-tone digital chime using Web Audio API
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") {
          console.warn("AudioContext is suspended. Autoplay requires initial user interaction.");
          return;
        }

        // Helper function to synthesize sweet sine wave frequencies with high responsiveness
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);

          // Clean gain curve with quick attack and linear decay
          gainNode.gain.setValueAtTime(0.0, start);
          gainNode.gain.linearRampToValueAtTime(0.2, start + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.start(start);
          osc.stop(start + duration);
        };

        // Beautiful, bright arpeggiated high frequency chime chord
        playTone(587.33, audioCtx.currentTime, 0.45);      // D5
        playTone(880.00, audioCtx.currentTime + 0.08, 0.45); // A5
        playTone(1174.66, audioCtx.currentTime + 0.16, 0.6); // D6
      } catch (synthErr) {
        console.error("Synthesizer error:", synthErr);
      }
    }
  }, []);

  // Public manual trigger allowing user to test the sound and register active gesture unlock
  const playTestSound = useCallback(() => {
    playAlertSound();
  }, [playAlertSound]);

  // Request permissions and grab token
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.warn("This device does not support Web Notifications.");
      return null;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        const supported = await isSupported();
        if (!supported) {
          console.warn("Firebase Cloud Messaging is not supported on this browser.");
          return null;
        }

        const messaging = getMessaging(app);
        
        // VAPID key configuration
        const vapidKey = (import.meta as any).env?.VITE_FCM_VAPID_KEY || undefined;
        
        // Direct registrations avoids hangs and mismatch on Vercel
        const registration = "serviceWorker" in navigator 
          ? await navigator.serviceWorker.register("/firebase-messaging-sw.js")
          : undefined;

        const currentToken = await getToken(messaging, { 
          vapidKey,
          serviceWorkerRegistration: registration
        });

        if (currentToken) {
          setToken(currentToken);
          console.log("FCM Registration Token received:", currentToken);

          if (auth.currentUser) {
            const tokenDocRef = doc(db, "fcm_tokens", auth.currentUser.uid);
            await setDoc(tokenDocRef, {
              token: currentToken,
              lastUpdated: new Date().toISOString(),
              email: auth.currentUser.email || "",
              platform: "web-pwa"
            }, { merge: true });
          }
          return currentToken;
        } else {
          console.warn("No registration token available.");
        }
      }
    } catch (err) {
      console.error("An error occurred while fetching FCM token:", err);
    }
    return null;
  }, []);

  // Check consent status on startup and fetch token if already granted
  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        requestPermission();
      }
    }
  }, [requestPermission]);

  // Sync token whenever Current User is loaded or changed
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user && token) {
        const tokenDocRef = doc(db, "fcm_tokens", user.uid);
        setDoc(tokenDocRef, {
          token,
          lastUpdated: new Date().toISOString(),
          email: user.email || "",
          platform: "web-pwa"
        }, { merge: true }).catch(err => {
          console.error("Failed to sync FCM token to user document:", err);
        });
      }
    });
    return unsub;
  }, [token]);

  // Setup foreground listener
  useEffect(() => {
    let unsubscribeOnMessage: (() => void) | undefined;

    const setupListener = async () => {
      const supported = await isSupported();
      if (!supported) return;

      try {
        const messaging = getMessaging(app);
        unsubscribeOnMessage = onMessage(messaging, (payload) => {
          console.log("Foreground FCM notification received:", payload);
          
          const newAlert: WebNotification = {
            id: payload.messageId || Math.random().toString(),
            title: payload.notification?.title || "עדכון חדש",
            body: payload.notification?.body || "",
            timestamp: new Date(),
            data: payload.data
          };

          setNotifications((prev) => [newAlert, ...prev]);

          // Sound trigger!
          playAlertSound();

          // Show browser notification if requested even while in foreground
          if (Notification.permission === "granted") {
            new Notification(newAlert.title, {
              body: newAlert.body,
              icon: "/assets/icon_192.png",
              data: payload.data
            });
          }
        });
      } catch (err) {
        console.warn("FCM Message listener failed to attach (offline / missing initialization):", err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [playAlertSound]);

  return {
    permission,
    token,
    notifications,
    requestPermission,
    playTestSound,
    hasUserGesture,
    setNotifications
  };
}
