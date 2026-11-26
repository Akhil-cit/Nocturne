import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Download, Flame, Headphones, Music, Play, Sparkles, User } from 'lucide-react';
import { computeAnalytics, type AnalyticsRange } from '@/services/history/listeningAnalytics';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { usePlayerStore } from '@/stores/playerStore';
import ArtworkImage from '@/components/ui/ArtworkImage';

function formatMins(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

export function InsightsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const events = useAnalyticsStore((s) => s.events);
  const activeSession = useAnalyticsStore((s) => s.activeSession);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);

  const liveEvents = useMemo(() => {
    if (!activeSession || activeSession.listenSec < 2) return events;
    return [
      ...events,
      {
        track: activeSession.track,
        playedAt: activeSession.startedAt,
        listenSec: Math.round(activeSession.listenSec),
      },
    ];
  }, [events, activeSession]);

  const stats = useMemo(() => computeAnalytics(liveEvents, range), [liveEvents, range]);
  const maxDaily = Math.max(1, ...stats.dailyActivity.map((d) => d.listenSec));
  const maxHourly = Math.max(1, ...stats.hourlyDistribution);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocturne-insights-${range}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-white/45 font-medium">
            Listening Intelligence
          </span>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-0.5">Insights</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-wrapped-btn"
            onClick={() => setWrappedOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Nocturne Wrapped
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/12 text-xs text-white/80 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              range === r.id
                ? 'bg-white text-[#0a0a0a]'
                : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/12'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Listening Time', value: formatMins(stats.totalListenSec), icon: Headphones },
          { label: 'Total Plays', value: String(stats.totalPlays), icon: Play },
          { label: 'Unique Tracks', value: String(stats.uniqueTracks), icon: Music },
          { label: 'Unique Artists', value: String(stats.uniqueArtists), icon: User },
          { label: 'Current Streak', value: `${stats.currentStreakDays}d`, icon: Flame },
          {
            label: 'Peak Hour',
            value: stats.peakHour !== null ? `${stats.peakHour}:00` : '—',
            icon: BarChart2,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-1.5"
          >
            <div className="flex items-center justify-between text-white/45 text-[11px]">
              <span>{card.label}</span>
              <card.icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
          <h2 className="text-sm font-semibold text-white">Daily Activity</h2>
          {stats.dailyActivity.length === 0 ? (
            <p className="text-xs text-white/40 py-8 text-center">No listening data for this period.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {stats.dailyActivity.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    title={`${d.date}: ${formatMins(d.listenSec)}`}
                    className="w-full max-w-[24px] rounded-t bg-white/75 hover:bg-white transition-colors"
                    style={{ height: `${d.listenSec > 0 ? Math.max(6, (d.listenSec / maxDaily) * 100) : 2}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
          <h2 className="text-sm font-semibold text-white">Hourly Distribution</h2>
          <div className="flex items-end gap-1 h-32">
            {stats.hourlyDistribution.map((sec, hr) => (
              <div key={hr} className="flex-1 flex flex-col items-center h-full justify-end">
                <div
                  title={`${hr}:00 — ${formatMins(sec)}`}
                  className="w-full rounded-t bg-indigo-400/75 hover:bg-indigo-300 transition-colors"
                  style={{ height: `${sec > 0 ? Math.max(6, (sec / maxHourly) * 100) : 2}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tracks & Top Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-3">
          <h2 className="text-sm font-semibold text-white">Top Tracks</h2>
          {stats.topTracks.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">Play songs to see your top tracks.</p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {stats.topTracks.map((item, idx) => (
                <div
                  key={item.track.id}
                  onClick={() => {
                    const list = stats.topTracks.map((t) => t.track);
                    setQueue(list, idx);
                    void play(item.track);
                  }}
                  className="flex items-center gap-3 py-2 hover:bg-white/[0.04] rounded-lg px-2 cursor-pointer"
                >
                  <span className="w-5 text-xs text-white/40 tabular-nums">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-md overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    <ArtworkImage
                      src={item.track.cover}
                      alt={item.track.title}
                      type="track"
                      title={item.track.title}
                      artist={item.track.artist}
                      className="w-full h-full object-cover"
                      iconClassName="w-4 h-4 text-white/25"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{item.track.title}</p>
                    <p className="text-[11px] text-white/50 truncate">{item.track.artist}</p>
                  </div>
                  <span className="text-[11px] text-white/50 tabular-nums">{item.plays} plays</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-3">
          <h2 className="text-sm font-semibold text-white">Top Artists</h2>
          {stats.topArtists.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">Play songs to see your top artists.</p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {stats.topArtists.map((a, idx) => (
                <div
                  key={a.name}
                  onClick={() => navigate(`/artist/name:${encodeURIComponent(a.name)}?name=${encodeURIComponent(a.name)}`)}
                  className="flex items-center gap-3 py-2 hover:bg-white/[0.04] rounded-lg px-2 cursor-pointer"
                >
                  <span className="w-5 text-xs text-white/40 tabular-nums">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                    <ArtworkImage
                      src={a.picture}
                      alt={a.name}
                      type="artist"
                      title={a.name}
                      className="w-full h-full object-cover"
                      iconClassName="w-4 h-4 text-white/25"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{a.name}</p>
                    <p className="text-[11px] text-white/50">{formatMins(a.listenSec)}</p>
                  </div>
                  <span className="text-[11px] text-white/50 tabular-nums">{a.plays} plays</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nocturne Wrapped Modal */}
      {wrappedOpen && (
        <div
          data-testid="wrapped-modal"
          className="fixed inset-0 z-[9999] bg-[#07070b]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full rounded-3xl bg-gradient-to-b from-indigo-500/20 to-white/[0.03] border border-white/15 p-8 space-y-6">
            <span className="text-[11px] uppercase tracking-widest text-indigo-300 font-semibold">
              Nocturne Wrapped · {range.toUpperCase()}
            </span>
            <div className="space-y-2">
              <p className="text-5xl font-bold text-white tabular-nums">
                {Math.round(stats.totalListenSec / 60)}
              </p>
              <p className="text-sm text-white/65">minutes listened</p>
            </div>
            {stats.topTracks[0] && (
              <div className="p-4 rounded-2xl bg-white/[0.06] space-y-1">
                <p className="text-[11px] text-white/45 uppercase">Top Song</p>
                <p className="text-base font-semibold text-white truncate">{stats.topTracks[0].track.title}</p>
                <p className="text-xs text-white/60 truncate">{stats.topTracks[0].track.artist}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setWrappedOpen(false)}
              className="px-6 py-2 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightsPage;
