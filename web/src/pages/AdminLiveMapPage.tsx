import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Car, 
  AlertTriangle,
  Search, RefreshCw, Loader2,
  MapPin, AlertCircle, Layers, 
  Navigation as NavIcon, Activity, History, CheckCircle,
  Zap, Info, MoreHorizontal, Download, User, X, Maximize2, Map as MapIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { io } from 'socket.io-client';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, TrafficLayer } from '@react-google-maps/api';

interface ActiveRental {
  id: string;
  customer: { fullName: string };
  vehicle: {
    brand: string;
    model: string;
    licensePlate: string;
  };
  locations: Array<{
    latitude: number;
    longitude: number;
    recordedAt: string;
    speed: number | null;
    accuracy: number | null;
    batteryLevel: number | null;
  }>;
  geofenceAlerts: any[];
}

interface FleetStats {
  total: number;
  available: number;
  active: number;
  maintenance: number;
}

const NEGROS_DEFAULT_CENTER = { 
  lat: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '10.3000'), 
  lng: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '123.0000') 
};
const DEFAULT_ZOOM = parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM || '9');
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const AdminLiveMapPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRental, setSelectedRental] = useState<ActiveRental | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [hoveredRental, setHoveredRental] = useState<ActiveRental | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [unresolvedAlerts, setUnresolvedAlerts] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY
  });

  const mapCenter = useMemo(() => {
    if (selectedRental?.locations?.[0]) {
      return { lat: selectedRental.locations[0].latitude, lng: selectedRental.locations[0].longitude };
    }
    const firstWithLoc = activeRentals.find(r => r.locations?.[0]);
    if (firstWithLoc?.locations?.[0]) {
      return { lat: firstWithLoc.locations[0].latitude, lng: firstWithLoc.locations[0].longitude };
    }
    return NEGROS_DEFAULT_CENTER;
  }, [selectedRental, activeRentals]);

  const mapZoom = useMemo(() => {
    if (selectedRental?.locations?.[0]) return 16;
    const firstWithLoc = activeRentals.find(r => r.locations?.[0]);
    if (firstWithLoc?.locations?.[0]) return 12;
    return DEFAULT_ZOOM;
  }, [selectedRental, activeRentals]);

  const fetchMonitoringData = async () => {
    try {
      const [locationsRes, summaryRes, alertsRes] = await Promise.all([
        adminApi.getLiveLocations(),
        adminApi.getSummaryReport(),
        adminApi.getGeofenceAlertReport()
      ]);

      setActiveRentals(locationsRes.data);
      
      if (summaryRes.data) {
        setFleetStats({
          total: summaryRes.data.vehicles.total,
          available: summaryRes.data.vehicles.available,
          active: summaryRes.data.bookings.active,
          maintenance: summaryRes.data.vehicles.total - summaryRes.data.vehicles.available - summaryRes.data.bookings.active // Estimate
        });
      }

      if (alertsRes.data) {
        setUnresolvedAlerts(alertsRes.data.details.filter((a: any) => !a.resolved));
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Poll every 30s as fallback

    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4000');

    socket.on('connect', () => setIsRealtime(true));
    socket.on('disconnect', () => setIsRealtime(false));

    socket.on('vehicle-location-updated', (data) => {
      handleNewLocation(data);
    });

    socket.on('geofence-alert-created', () => {
      fetchMonitoringData();
    });

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleNewLocation = (newLoc: any) => {
    setActiveRentals(prev => prev.map(rental => {
      if (rental.id === newLoc.bookingId) {
        return {
          ...rental,
          locations: [{
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
            recordedAt: newLoc.recordedAt,
            speed: newLoc.speed,
            accuracy: newLoc.accuracy || null,
            batteryLevel: newLoc.batteryLevel || null
          }]
        };
      }
      return rental;
    }));
    
    // Update selected rental if it's the one that moved
    setSelectedRental(prev => {
      if (prev && prev.id === newLoc.bookingId) {
        return {
          ...prev,
          locations: [{
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
            recordedAt: newLoc.recordedAt,
            speed: newLoc.speed,
            accuracy: newLoc.accuracy || null,
            batteryLevel: newLoc.batteryLevel || null
          }]
        };
      }
      return prev;
    });

    setLastUpdated(new Date());
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await adminApi.resolveGeofenceAlert(alertId);
      fetchMonitoringData();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const filteredRentals = useMemo(() => 
    activeRentals.filter(r => 
      r.customer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicle.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicle.model.toLowerCase().includes(searchQuery.toLowerCase())
    ), [activeRentals, searchQuery]
  );

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onMapUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Update map center when a rental is selected
  useEffect(() => {
    if (selectedRental?.locations?.[0] && map) {
      map.panTo({
        lat: selectedRental.locations[0].latitude,
        lng: selectedRental.locations[0].longitude
      });
      map.setZoom(16);
    }
  }, [selectedRental, map]);

  const handleTrackVehicle = (rental: ActiveRental) => {
    setSelectedRental(rental);
    if (rental.locations?.[0] && map) {
      map.panTo({
        lat: rental.locations[0].latitude,
        lng: rental.locations[0].longitude
      });
      map.setZoom(16);
    }
  };

  const renderMapArea = () => {
    if (!API_KEY) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--gray-100)' }}>
          <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <AlertCircle size={48} color="var(--status-error)" style={{ margin: '0 auto 1.5rem' }} />
            <h3>Google Maps Key Missing</h3>
            <p className="text-gray-500" style={{ marginTop: '0.5rem' }}>Add VITE_GOOGLE_MAPS_API_KEY to your .env file.</p>
          </div>
        </div>
      );
    }

    if (loadError) return <div className="card">Error loading map.</div>;
    if (!isLoaded) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" color="var(--warm-taupe)" /></div>;


    return (
      <GoogleMap
        mapContainerClassName="google-map-container"
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        mapTypeId={mapType}
        options={{
          styles: [
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
            { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          scaleControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
          },
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
          }
        }}
      >
        {showTraffic && <TrafficLayer />}
        
        {activeRentals.map(rental => {
          const loc = rental.locations?.[0];
          if (!loc) return null;
          
          return (
            <React.Fragment key={rental.id}>
              <Marker
                position={{ lat: loc.latitude, lng: loc.longitude }}
                onClick={() => setSelectedRental(rental)}
                onMouseOver={() => setHoveredRental(rental)}
                onMouseOut={() => setHoveredRental(null)}
                icon={{
                  path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z',
                  fillColor: rental.geofenceAlerts?.length > 0 ? '#DC2626' : (selectedRental?.id === rental.id ? '#000000' : '#AD9B8D'),
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#FFFFFF',
                  scale: 1.5,
                  anchor: new google.maps.Point(12, 12)
                }}
              />
              {(hoveredRental?.id === rental.id || selectedRental?.id === rental.id) && (
                <InfoWindow
                  position={{ lat: loc.latitude, lng: loc.longitude }}
                  onCloseClick={() => {
                    if (selectedRental?.id === rental.id) setSelectedRental(null);
                  }}
                >
                  <div style={{ padding: '0.5rem', minWidth: '150px' }}>
                    <div className="font-bold" style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {rental.vehicle.brand} {rental.vehicle.model}
                    </div>
                    <div className="text-xs text-gray-500" style={{ marginBottom: '0.5rem' }}>
                      {rental.vehicle.licensePlate} • {rental.customer.fullName}
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Speed: {loc.speed ? `${Math.round(loc.speed * 3.6)} km/h` : '0 km/h'}</span>
                      <span className="text-gray-400">{new Date(loc.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>
    );
  };

  return (
    <div className="map-dashboard-layout">
      {/* Top Control Bar */}
      <header className="map-dashboard-header">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-black text-white p-2.5 rounded-xl flex items-center justify-center">
              <NavIcon size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black leading-none" style={{ margin: 0 }}>Map Dashboard</h1>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Fleet Monitoring</span>
            </div>
          </div>

          <div className="flex items-center gap-6 border-gray-100" style={{ borderLeft: '1.5px solid', paddingLeft: '2rem' }}>
            <div className="flex items-center gap-3">
              <div className="flex" style={{ marginLeft: '0.5rem' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center overflow-hidden" style={{ marginLeft: i === 1 ? 0 : '-0.5rem' }}>
                    <User size={16} color="var(--gray-400)" />
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <span className="font-black">{activeRentals.length}</span>
                <span className="text-gray-400 font-bold ml-1.5 uppercase text-[10px]">Active Vehicles</span>
              </div>
            </div>
            
            <div className="live-badge">
              <div className={`live-ping ${isRealtime ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="uppercase">{isRealtime ? 'Socket Live' : 'Offline'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setMapType('roadmap')}
              style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s', backgroundColor: mapType === 'roadmap' ? 'white' : 'transparent', color: mapType === 'roadmap' ? 'black' : 'var(--gray-400)', boxShadow: mapType === 'roadmap' ? 'var(--shadow-sm)' : 'none' }}
            >
              Map
            </button>
            <button 
              onClick={() => setMapType('hybrid')}
              style={{ padding: '0.45rem 1.25rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s', backgroundColor: mapType === 'hybrid' ? 'white' : 'transparent', color: mapType === 'hybrid' ? 'black' : 'var(--gray-400)', boxShadow: mapType === 'hybrid' ? 'var(--shadow-sm)' : 'none' }}
            >
              Satellite
            </button>
          </div>

          <button 
            onClick={() => setShowTraffic(!showTraffic)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${showTraffic ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600'}`}
          >
            <Layers size={14} />
            Traffic
          </button>

          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>UPDATED {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <button onClick={() => setIsFullScreen(true)} className="btn-primary" style={{ padding: '0.7rem 1.4rem', fontSize: '0.8rem' }}>
            <Maximize2 size={16} />
            Open Map View
          </button>
        </div>
      </header>

      {/* Dashboard Body */}
      <div className="map-dashboard-shell">
        {/* Left Column: Active Vehicles */}
        <aside className="map-vehicle-panel">
          <div className="map-search-input-wrapper">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="map-search-input"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
            {loading && activeRentals.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin" color="var(--warm-taupe)" /></div>
            ) : filteredRentals.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl p-8 border border-dashed border-gray-200">
                <Car size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-xs font-bold text-gray-400">No vehicles found</p>
              </div>
            ) : (
              filteredRentals.map(rental => (
                <div 
                  key={rental.id}
                  onClick={() => setSelectedRental(rental)}
                  className={`map-vehicle-card ${selectedRental?.id === rental.id ? 'map-vehicle-card-active' : ''} ${rental.geofenceAlerts?.length > 0 ? 'alert' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="card-icon">
                        <Car size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black" style={{ margin: 0 }}>{rental.vehicle.brand} {rental.vehicle.model}</h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{rental.vehicle.licensePlate}</span>
                      </div>
                    </div>
                    {rental.locations?.[0] ? (
                      <div className="live-badge">
                        <div className="live-ping" />
                        <span className="text-[9px]">LIVE</span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-50 px-1.5 py-0.5 rounded">NO GPS</span>
                    )}
                  </div>

                  <div className="space-y-2.5 mb-5">
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-600">{rental.customer.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-gray-300" />
                      <span className="text-[10px] font-semibold text-gray-400">
                        {rental.locations?.[0] ? `${rental.locations[0].latitude.toFixed(4)}, ${rental.locations[0].longitude.toFixed(4)}` : 'Waiting for signal...'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleTrackVehicle(rental); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all ${selectedRental?.id === rental.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <NavIcon size={12} />
                      Track
                    </button>
                    <button className="w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all border border-gray-100">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Map Area */}
        <main className="map-canvas-panel">
          {renderMapArea()}

          {/* Map Overlay: No GPS */}
          {selectedRental && !selectedRental.locations?.[0] && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/40 backdrop-blur-[2px] z-20">
              <div className="card text-center max-w-sm shadow-2xl" style={{ padding: '2.5rem', borderRadius: '32px' }}>
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Zap size={32} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-black mb-2">No GPS Signal</h3>
                <p className="text-xs text-gray-500 font-bold leading-relaxed">
                  Waiting for the first location update from <br/>
                  <span className="text-black">{selectedRental.vehicle.brand} {selectedRental.vehicle.model}</span>.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Column: Monitoring Panels */}
        <aside className="map-status-panel">
          {/* Fleet Status Summary */}
          <section className="card" style={{ padding: '1.25rem', borderRadius: '24px' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400" style={{ margin: 0 }}>Fleet Overview</h3>
              <Activity size={16} className="text-gray-300" />
            </div>
            
            <div className="space-y-3">
              <div className="fleet-active-bar flex items-center justify-between bg-black text-white p-3.5 rounded-2xl shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <NavIcon size={16} />
                  </div>
                  <span className="text-[11px] font-black uppercase">Active on road</span>
                </div>
                <span className="text-lg font-black">{fleetStats?.active || 0}</span>
              </div>

              <div className="monitoring-stat-grid">
                <div className="monitoring-stat-box">
                  <span className="monitoring-label">Available</span>
                  <div className="monitoring-value">{fleetStats?.available || 0}</div>
                </div>
                <div className="monitoring-stat-box">
                  <span className="monitoring-label">Service</span>
                  <div className="monitoring-value">{fleetStats?.maintenance || 0}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Alerts Panel */}
          <section className="card" style={{ padding: '1.25rem', borderRadius: '24px' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400" style={{ margin: 0 }}>Live Alerts</h3>
                {unresolvedAlerts.length > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {unresolvedAlerts.length}
                  </span>
                )}
              </div>
              <AlertTriangle size={16} className={unresolvedAlerts.length > 0 ? 'text-red-600' : 'text-gray-300'} />
            </div>

            <div className="space-y-3">
              {unresolvedAlerts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <CheckCircle size={20} className="mx-auto text-green-500 mb-2" />
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">No current threats</p>
                </div>
              ) : (
                unresolvedAlerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="bg-red-50 border border-red-100 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">Critical</span>
                      <span className="text-[8px] font-bold text-red-400">{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-[11px] font-black text-red-900 mb-0.5">{alert.vehicle.brand} {alert.vehicle.model}</div>
                    <p className="text-[9px] text-red-700 font-bold mb-3 leading-tight">{alert.message}</p>
                    <button 
                      onClick={() => resolveAlert(alert.id)}
                      className="w-full py-2 bg-red-600 text-white rounded-xl text-[9px] font-black hover:bg-red-700 transition-all shadow-sm"
                    >
                      RESOLVE
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Tracking Stats */}
          <section className="card" style={{ padding: '1.25rem', borderRadius: '24px' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400" style={{ margin: 0 }}>Monitoring Stats</h3>
              <Activity size={16} className="text-gray-300" />
            </div>

            <div className="space-y-4">
              <div className="map-status-row">
                <span className="map-status-label">Avg Fleet Speed</span>
                <span className="map-status-value">34 <span className="text-[9px] text-gray-400">km/h</span></span>
              </div>
              <div className="map-status-row">
                <span className="map-status-label">Breach Frequency</span>
                <span className="map-status-value text-red-600">Low</span>
              </div>
              <div className="map-status-row">
                <span className="map-status-label">GPS Accuracy</span>
                <span className="map-status-value text-green-600">High</span>
              </div>
              
              <div className="pt-2 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3">
                  <Info size={14} className="text-gray-400" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Odometer tracking pending.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="card" style={{ padding: '1.25rem', borderRadius: '24px' }}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5" style={{ margin: 0 }}>Actions</h3>
            <div className="map-actions-grid">
              <button className="flex flex-col items-center justify-center gap-2 p-3.5 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all opacity-50 cursor-not-allowed border border-gray-100">
                <Download size={16} className="text-gray-400" />
                <span className="text-[8px] font-black text-gray-500 uppercase">Report</span>
              </button>
              <button 
                onClick={() => navigate('/admin/gps-tracking')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all border border-gray-100"
              >
                <History size={16} className="text-black" />
                <span className="text-[8px] font-black text-black uppercase">History</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      {/* Full Screen Map Modal */}
      {isFullScreen && (
        <div className="map-fullscreen-overlay">
          <header className="map-fullscreen-header">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white p-2 rounded-lg">
                <MapIcon size={18} />
              </div>
              <div>
                <h2 className="text-base font-black" style={{ margin: 0 }}>Full-Screen Fleet Monitor</h2>
                {selectedRental && (
                  <span className="text-[10px] text-gray-500 font-bold uppercase">
                    Focus: {selectedRental.vehicle.brand} {selectedRental.vehicle.model} ({selectedRental.vehicle.licensePlate})
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setIsFullScreen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all"
            >
              <X size={24} />
            </button>
          </header>
          <div className="map-fullscreen-content">
            {renderMapArea()}
            
            {/* Minimal Overlay for Selected Vehicle in Full Screen */}
            {selectedRental && selectedRental.locations?.[0] && (
              <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', zIndex: 10 }}>
                <div className="card" style={{ padding: '1.25rem', borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-gray-50">
                      <Car size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black" style={{ margin: 0 }}>{selectedRental.vehicle.brand} {selectedRental.vehicle.model}</h4>
                      <div className="live-badge">
                        <div className="live-ping" />
                        <span className="text-[8px]">LIVE TELEMETRY</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-4">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Speed</span>
                      <span className="text-sm font-black">{selectedRental.locations[0].speed ? `${Math.round(selectedRental.locations[0].speed * 3.6)}` : '0'} <span className="text-[9px] text-gray-400">km/h</span></span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Customer</span>
                      <span className="text-sm font-black">{selectedRental.customer.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Status</span>
                      <span className="text-sm font-black text-green-600 uppercase">On Track</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No GPS Signal in Full Screen */}
            {selectedRental && !selectedRental.locations?.[0] && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/40 backdrop-blur-[2px] z-20">
                <div className="card text-center max-w-sm shadow-2xl" style={{ padding: '3rem', borderRadius: '32px' }}>
                  <Zap size={48} className="text-gray-300 mx-auto mb-6" />
                  <h3 className="text-xl font-black mb-2">No GPS Signal</h3>
                  <p className="text-sm text-gray-500 font-bold leading-relaxed">Waiting for location update from {selectedRental.vehicle.licensePlate}</p>
                  <button onClick={() => setIsFullScreen(false)} className="btn-outline mt-8 w-full">Close View</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLiveMapPage;
