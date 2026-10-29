import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';

const TimerContext = createContext(null);
const KEY = 'ff_timer';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

// A fully client-side stopwatch that supports pause / resume / reset.
// State is mirrored to localStorage so the timer survives navigation and a
// browser refresh. On "Stop & Save" the banked time is persisted to the
// backend as a time log via /timelogs/manual.
export function TimerProvider({ children }) {
  // timer = { projectId, projectName, description, accumulated, runningSince }
  const [timer, setTimer] = useState(loadState);
  const [, force] = useState(0);
  const tick = useRef(null);

  useEffect(() => {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  }, [timer]);

  // Re-render every second only while actively running.
  useEffect(() => {
    clearInterval(tick.current);
    if (timer?.runningSince) {
      tick.current = setInterval(() => force((n) => n + 1), 1000);
    }
    return () => clearInterval(tick.current);
  }, [timer?.runningSince]);

  const elapsed = timer
    ? Math.floor(
        timer.accumulated +
          (timer.runningSince ? (Date.now() - timer.runningSince) / 1000 : 0)
      )
    : 0;

  const active = !!timer;
  const running = !!timer?.runningSince;

  const start = (projectId, projectName, description) =>
    setTimer({
      projectId,
      projectName,
      description: description || '',
      accumulated: 0,
      runningSince: Date.now(),
    });

  const pause = () =>
    setTimer((t) =>
      t && t.runningSince
        ? {
            ...t,
            accumulated: t.accumulated + (Date.now() - t.runningSince) / 1000,
            runningSince: null,
          }
        : t
    );

  const resume = () =>
    setTimer((t) => (t && !t.runningSince ? { ...t, runningSince: Date.now() } : t));

  const reset = () =>
    setTimer((t) =>
      t ? { ...t, accumulated: 0, runningSince: t.runningSince ? Date.now() : null } : t
    );

  const cancel = () => setTimer(null);

  const stop = async () => {
    if (!timer) return null;
    const seconds =
      timer.accumulated + (timer.runningSince ? (Date.now() - timer.runningSince) / 1000 : 0);
    const hours = seconds / 3600;
    let saved = null;
    if (hours > 0 && timer.projectId) {
      const { data } = await api.post('/timelogs/manual', {
        project_id: timer.projectId,
        description: timer.description,
        hours: Number(hours.toFixed(4)),
      });
      saved = data;
    }
    setTimer(null);
    return saved;
  };

  return (
    <TimerContext.Provider
      value={{ timer, elapsed, active, running, start, pause, resume, reset, cancel, stop }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => useContext(TimerContext);

export function formatElapsed(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
