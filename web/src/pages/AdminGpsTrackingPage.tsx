import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { History, Clock, FileText, Download, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { adminApi, bookingsApi, settingsApi } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

const DEFAULT_CENTER = {
  lat: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '10.3000'),
  lng: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '123.0000'),
};

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
}

/** Haversine distance between two lat/lng points in kilometres */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const AdminGpsTrackingPage: React.FC = () => {
  const { setPageHeader } = usePageHeader();
  const toast = useToast();

  const [stats, setStats] = useState<{ locationCount: number; sessionCount: number } | null>(null);
  const [completedBookings, setCompletedBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();
  const [defaultCenter, setDefaultCenter] = useState(DEFAULT_CENTER);

  useEffect(() => {
    settingsApi.getAll()
      .then((res) => {
        const lat = parseFloat(res.data?.map?.centerLat);
        const lng = parseFloat(res.data?.map?.centerLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          setDefaultCenter({ lat, lng });
        }
      })
      .catch(() => {
        // Fall back to DEFAULT_CENTER
      });
  }, []);

  useEffect(() => {
    setPageHeader({
      title: 'GPS Tracking',
      subtitle: 'Session movement playback and location history export',
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  // Load stats and completed bookings on mount
  useEffect(() => {
    adminApi
      .getGpsStats()
      .then(({ data }) => setStats(data))
      .catch(() => setStats({ locationCount: 0, sessionCount: 0 }))
      .finally(() => setLoadingStats(false));

    bookingsApi
      .getActiveList(['COMPLETED'])
      .then(({ data }) => setCompletedBookings(data || []))
      .catch(() => setCompletedBookings([]))
      .finally(() => setLoadingBookings(false));
  }, []);

  // Fit map to full route when locations and map instance are both ready
  useEffect(() => {
    if (!mapInstance || locations.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    locations.forEach((l) => bounds.extend({ lat: l.latitude, lng: l.longitude }));
    mapInstance.fitBounds(bounds);
  }, [mapInstance, locations]);

  const onMapLoad = useCallback((m: google.maps.Map) => {
    setMapInstance(m);
  }, []);

  const handleBookingSelect = async (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setLocations([]);
    if (!bookingId) return;
    setLoadingSession(true);
    try {
      const { data } = await adminApi.getGpsSession(bookingId);
      setLocations(data.locations || []);
    } catch {
      toast.error('Failed to load session', 'Could not fetch GPS data for this session.');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBookingId) return;
    setExporting(true);
    try {
      const response = await adminApi.exportGpsSession(selectedBookingId);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const booking = completedBookings.find((b) => b.id === selectedBookingId);
      const plate =
        booking?.vehicle?.licensePlate?.replace(/\s+/g, '-') || selectedBookingId.slice(0, 8);
      const date = booking?.startDate
        ? new Date(booking.startDate).toISOString().split('T')[0]
        : 'unknown';
      a.href = url;
      a.download = `gps-session-${plate}-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export complete', 'GPS session data downloaded successfully.');
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error('No GPS data', 'No GPS data available for this session.');
      } else {
        toast.error('Export failed', 'Failed to export GPS data.');
      }
    } finally {
      setExporting(false);
    }
  };

  // Derived session statistics
  const sessionStats = useMemo(() => {
    if (locations.length === 0) return null;
    let totalKm = 0;
    for (let i = 1; i < locations.length; i++) {
      totalKm += haversineKm(
        locations[i - 1].latitude,
        locations[i - 1].longitude,
        locations[i].latitude,
        locations[i].longitude
      );
    }
    const durationMs =
      new Date(locations[locations.length - 1].recordedAt).getTime() -
      new Date(locations[0].recordedAt).getTime();
    const durationMin = Math.round(durationMs / 60000);
    const speeds = locations
      .map((l) => l.speed)
      .filter((s): s is number => s !== null && s >= 0);
    const avgSpeed =
      speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    return {
      totalKm: totalKm.toFixed(2),
      durationMin,
      avgSpeed: avgSpeed !== null ? avgSpeed.toFixed(1) : null,
      pointCount: locations.length,
    };
  }, [locations]);

  const polylinePath = locations.map((l) => ({ lat: l.latitude, lng: l.longitude }));
  const startPoint = locations[0] ?? null;
  const endPoint = locations.length > 1 ? locations[locations.length - 1] : null;
  const hasSelection = !!selectedBookingId;
  const hasLocations = locations.length > 0;
  const canExport = hasSelection && hasLocations && !exporting;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2.5rem',
        }}
      >
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <History color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Total Logs Stored</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>
            {loadingStats ? '—' : (stats?.locationCount ?? 0).toLocaleString()}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>
            GPS location records in database
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Clock color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Retention Period</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>
            90 Days
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>
            Standard telemetry storage policy
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileText color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Session Reports</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>
            {loadingStats ? '—' : stats?.sessionCount ?? 0}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>
            Completed sessions with GPS data
          </p>
        </div>
      </div>

      {/* ── Main Panel ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '2rem' }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem' }}>
              Session Movement Playback
            </h3>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--gray-500)', fontSize: '0.875rem' }}>
              Select a completed rental to view the vehicle's recorded GPS route.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: canExport ? 1 : 0.45,
              cursor: canExport ? 'pointer' : 'not-allowed',
            }}
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Location History Export
          </button>
        </div>

        {/* Booking selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              color: 'var(--gray-600)',
            }}
          >
            Select Completed Rental Session
          </label>
          {loadingBookings ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--gray-400)',
                fontSize: '0.875rem',
              }}
            >
              <Loader2 size={16} className="animate-spin" /> Loading sessions…
            </div>
          ) : (
            <select
              value={selectedBookingId}
              onChange={(e) => handleBookingSelect(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '640px',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1.5px solid var(--gray-200)',
                fontSize: '0.9rem',
                backgroundColor: 'white',
              }}
            >
              <option value="">— Select a completed session —</option>
              {completedBookings.length === 0 && (
                <option disabled value="">
                  No completed sessions available
                </option>
              )}
              {completedBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.vehicle?.licensePlate} — {b.customer?.fullName} (
                  {new Date(b.startDate).toLocaleDateString()} →{' '}
                  {new Date(b.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Session loading spinner */}
        {loadingSession && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5rem',
              color: 'var(--gray-400)',
              gap: '0.75rem',
            }}
          >
            <Loader2 size={24} className="animate-spin" /> Loading GPS session data…
          </div>
        )}

        {/* No booking selected yet */}
        {!hasSelection && !loadingBookings && (
          <div
            style={{
              padding: '4rem',
              textAlign: 'center',
              backgroundColor: 'var(--gray-50)',
              borderRadius: '16px',
              border: '1px dashed var(--gray-200)',
            }}
          >
            <MapPin size={40} color="var(--gray-300)" style={{ margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 700, color: 'var(--gray-600)', marginBottom: '0.4rem' }}>
              Select a Session to Begin
            </p>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', margin: 0 }}>
              Choose a completed rental from the dropdown above to view its GPS route and export
              location data.
            </p>
          </div>
        )}

        {/* No GPS data for selected booking */}
        {!loadingSession && hasSelection && !hasLocations && (
          <div
            style={{
              padding: '4rem',
              textAlign: 'center',
              backgroundColor: 'var(--gray-50)',
              borderRadius: '16px',
              border: '1px solid var(--gray-200)',
            }}
          >
            <AlertCircle size={40} color="var(--gray-300)" style={{ margin: '0 auto 1rem' }} />
            <p style={{ fontWeight: 700, color: 'var(--gray-600)', marginBottom: '0.4rem' }}>
              No GPS Data Recorded
            </p>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', margin: 0 }}>
              No GPS logs were captured for this session. The mobile app may not have been active
              during the rental.
            </p>
          </div>
        )}

        {/* Map + session stats */}
        {!loadingSession && hasLocations && (
          <>
            {/* Map */}
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '1.5rem',
                border: '1px solid var(--gray-200)',
              }}
            >
              {loadError ? (
                <div
                  style={{
                    height: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--gray-50)',
                    color: 'var(--gray-500)',
                    fontSize: '0.9rem',
                  }}
                >
                  Failed to load Google Maps. Check your VITE_GOOGLE_MAPS_API_KEY.
                </div>
              ) : !isLoaded ? (
                <div
                  style={{
                    height: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--gray-50)',
                  }}
                >
                  <Loader2 size={32} className="animate-spin" color="var(--gray-400)" />
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '400px' }}
                  center={
                    startPoint
                      ? { lat: startPoint.latitude, lng: startPoint.longitude }
                      : defaultCenter
                  }
                  zoom={13}
                  onLoad={onMapLoad}
                  options={{
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {/* Route polyline — only when 2+ points */}
                  {locations.length > 1 && (
                    <Polyline
                      path={polylinePath}
                      options={{
                        strokeColor: '#2563EB',
                        strokeWeight: 3,
                        strokeOpacity: 0.85,
                      }}
                    />
                  )}

                  {/* Start marker — green */}
                  {startPoint && (
                    <Marker
                      position={{ lat: startPoint.latitude, lng: startPoint.longitude }}
                      icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                      title={`Start — ${new Date(startPoint.recordedAt).toLocaleString()}`}
                    />
                  )}

                  {/* End marker — red (only when different from start) */}
                  {endPoint && (
                    <Marker
                      position={{ lat: endPoint.latitude, lng: endPoint.longitude }}
                      icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                      title={`End — ${new Date(endPoint.recordedAt).toLocaleString()}`}
                    />
                  )}
                </GoogleMap>
              )}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--gray-500)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#16A34A',
                    display: 'inline-block',
                  }}
                />{' '}
                Trip Start
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#DC2626',
                    display: 'inline-block',
                  }}
                />{' '}
                Trip End
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '3px',
                    backgroundColor: '#2563EB',
                    display: 'inline-block',
                    borderRadius: '2px',
                  }}
                />{' '}
                Route
              </span>
            </div>

            {/* Session stats */}
            {sessionStats && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '1rem',
                }}
              >
                <StatCard label="Total Distance" value={`${sessionStats.totalKm} km`} />
                <StatCard
                  label="Duration"
                  value={
                    sessionStats.durationMin < 60
                      ? `${sessionStats.durationMin} min`
                      : `${Math.floor(sessionStats.durationMin / 60)}h ${sessionStats.durationMin % 60}m`
                  }
                />
                {sessionStats.avgSpeed && (
                  <StatCard label="Avg. Speed" value={`${sessionStats.avgSpeed} km/h`} />
                )}
                <StatCard label="GPS Points" value={sessionStats.pointCount.toLocaleString()} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      backgroundColor: 'var(--gray-50)',
      padding: '1.25rem',
      borderRadius: '12px',
      border: '1px solid var(--gray-100)',
    }}
  >
    <div
      style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: 'var(--gray-400)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--black)' }}>{value}</div>
  </div>
);

export default AdminGpsTrackingPage;
