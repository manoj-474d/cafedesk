import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  type MapCameraChangedEvent,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  ArrowUpRight,
  Coffee,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Search,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import { BENGALURU_AREAS, BENGALURU_CENTER } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import type { LocationItem } from '../types/cms';
import type { GoogleDiscoveryCafe, LatLngPoint } from '../context/DiscoveryContext';
import { formatDistanceKm, getCafeDetailRoute } from '../utils/cafeHelpers';
import { GOOGLE_MAPS_API_KEY } from '../App';

export interface MapMarkerItem {
  id: string;
  title: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  slug?: string;
  wifiMbps?: number | null;
  avgCost?: number | null;
  rating?: number | null;
  distanceKm?: number | null;
  mapLink: string;
  source: 'curated' | 'google';
}

interface InteractiveCafeMapProps {
  curatedLocations: Array<LocationItem & { distanceKm?: number | null }>;
  googleCafes?: GoogleDiscoveryCafe[];
  userLocation?: LatLngPoint | null;
  focusCenter?: LatLngPoint | null;
  heightClassName?: string;
  selectedArea?: string;
  onSelectArea?: (area: string) => void;
  onRequestNearMe?: () => void;
  onSearchThisArea?: (center: LatLngPoint) => void;
}

function approxKmBetween(a: LatLngPoint, b: LatLngPoint): number {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 108;
  return Math.hypot(dLat, dLng);
}

function MapCameraSync({ center, zoom }: { center: LatLngPoint; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(center);
    map.setZoom(zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

function CafeMarkerPin({
  item,
  selected,
  isDesktop,
  onSelect,
  onClose,
}: {
  item: MapMarkerItem;
  selected: boolean;
  isDesktop: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { authenticated } = useAuth();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isCurated = item.source === 'curated';
  const distText = formatDistanceKm(item.distanceKm);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.lat, lng: item.lng }}
        onClick={onSelect}
        title={item.title}
      >
        <Pin
          background={isCurated ? '#b45309' : '#1b4d3e'}
          borderColor={isCurated ? '#78350f' : '#133a2e'}
          glyphColor="#ffffff"
          scale={selected ? 1.25 : 1}
        />
      </AdvancedMarker>

      {selected && isDesktop && marker && (
        <InfoWindow anchor={marker} maxWidth={270} onCloseClick={onClose}>
          <div className="p-1 space-y-2 text-[#1c1613] max-w-[240px]">
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b45309]">
                {isCurated ? `${item.area} · Cafe Desk` : `${item.area} · Google Maps`}
              </p>
              <h3 className="font-serif-display text-sm font-bold leading-snug text-[#1c1613]">
                {item.title}
              </h3>
              <p className="text-[11px] text-[#5c4e45] line-clamp-2">{item.address}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#1c1613] font-medium">
              {distText && (
                <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-semibold font-mono-data">
                  <Navigation className="w-3 h-3" aria-hidden="true" />
                  {distText}
                </span>
              )}
              {item.rating !== null && item.rating !== undefined && (
                <span className="inline-flex items-center gap-0.5 font-semibold font-mono-data">
                  <Star className="w-3 h-3 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                  {item.rating}
                </span>
              )}
              {isCurated && (
                <span className="inline-flex items-center gap-1 text-[#5c4e45]">
                  <Wifi className="w-3 h-3" aria-hidden="true" />
                  {item.wifiMbps !== null && item.wifiMbps !== undefined
                    ? `${item.wifiMbps} Mbps`
                    : 'Speed not verified'}
                </span>
              )}
              {item.avgCost !== null && item.avgCost !== undefined && (
                <span className="font-mono-data">₹{item.avgCost} avg</span>
              )}
            </div>

            <div className="pt-1.5 border-t border-[#e6ddd0] flex items-center justify-between gap-2 text-xs">
              {item.slug ? (
                <Link
                  to={getCafeDetailRoute(item.slug, authenticated)}
                  className="font-semibold text-[#b45309] hover:underline"
                >
                  Explore Cafe &rarr;
                </Link>
              ) : (
                <span className="text-[11px] text-[#5c4e45]">Nearby cafe</span>
              )}
              {authenticated && item.mapLink && (
                <a
                  href={item.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-[#1c1613] hover:text-[#b45309]"
                >
                  <span>Directions</span>
                  <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function InteractiveCafeMap({
  curatedLocations,
  googleCafes = [],
  userLocation = null,
  focusCenter = null,
  heightClassName = 'h-[430px]',
  selectedArea = '',
  onSelectArea,
  onRequestNearMe,
  onSearchThisArea,
}: InteractiveCafeMapProps) {
  const { authenticated } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pannedCenter, setPannedCenter] = useState<LatLngPoint | null>(null);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<LatLngPoint | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const markerItems: MapMarkerItem[] = [];
  for (const loc of curatedLocations) {
    if (loc.lat !== null && loc.lng !== null) {
      markerItems.push({
        id: `curated-${loc.id}`,
        title: loc.name,
        area: loc.area,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        slug: loc.slug,
        wifiMbps: loc.wifi_mbps,
        avgCost: loc.avg_cost_per_person,
        rating: loc.rating,
        distanceKm: loc.distanceKm ?? null,
        mapLink: loc.map_link,
        source: 'curated',
      });
    }
  }

  for (const gc of googleCafes) {
    const duplicate = markerItems.some(
      (m) =>
        m.title.toLowerCase() === gc.name.toLowerCase() ||
        (Math.abs(m.lat - gc.lat) < 0.0004 && Math.abs(m.lng - gc.lng) < 0.0004)
    );
    if (!duplicate) {
      markerItems.push({
        id: `google-${gc.id}`,
        title: gc.name,
        area: gc.areaLabel || 'Bengaluru',
        address: gc.address,
        lat: gc.lat,
        lng: gc.lng,
        slug: gc.placeId ? `google:${encodeURIComponent(gc.placeId)}` : undefined,
        rating: gc.rating,
        distanceKm: gc.distanceKm,
        mapLink: gc.mapLink,
        source: 'google',
      });
    }
  }

  const cameraCenter: LatLngPoint =
    focusCenter ??
    userLocation ??
    (markerItems[0] ? { lat: markerItems[0].lat, lng: markerItems[0].lng } : BENGALURU_CENTER);
  const cameraZoom = focusCenter || userLocation ? 13 : 12;

  const selectedItem = markerItems.find((m) => m.id === selectedId) ?? null;

  const referenceCenter = lastSearchedCenter ?? cameraCenter;
  const showSearchAreaCta =
    Boolean(onSearchThisArea) &&
    pannedCenter !== null &&
    approxKmBetween(pannedCenter, referenceCenter) > 0.7;

  const handleCameraChanged = (ev: MapCameraChangedEvent) => {
    const c = ev.detail?.center;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      setPannedCenter({ lat: c.lat, lng: c.lng });
    }
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
              Bengaluru Map Explorer
            </p>
            <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[#1c1613]">
              Open neighborhood cafes directly in Google Maps
            </h3>
          </div>
          {onRequestNearMe && (
            <button
              type="button"
              onClick={onRequestNearMe}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              <LocateFixed className="w-4 h-4" aria-hidden="true" />
              <span>Use My Location</span>
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-1 no-scrollbar sm:flex-wrap">
          {BENGALURU_AREAS.slice(0, 8).map((areaName) => (
            <a
              key={areaName}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `cafes in ${areaName} Bengaluru`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full bg-[#faf7f2] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] hover:border-[#b45309] shrink-0 snap-start transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>{areaName}</span>
              <ArrowUpRight className="w-3 h-3 text-[#8c7a6b]" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 bg-white flex flex-col'
          : 'rounded-2xl border border-[#e6ddd0] bg-white overflow-hidden shadow-xs'
      }
    >
      {/* Map Controls Strip */}
      <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#faf7f2] border-b border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1c1613]">
            <Coffee className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
            <span className="font-mono-data">{markerItems.length}</span>
            <span>pinned cafes</span>
          </span>
          <span className="text-[#a89a8e] hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-[#5c4e45]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b45309] inline-block" />
            Curated
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-[#5c4e45]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b4d3e] inline-block" />
            Live
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSelectArea && (
            <select
              aria-label="Jump map to Bengaluru area"
              value={selectedArea}
              onChange={(e) => onSelectArea(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white border border-[#d6cbba] text-xs font-medium text-[#1c1613]"
            >
              <option value="">All Bengaluru</option>
              {BENGALURU_AREAS.slice(0, 8).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          {onRequestNearMe && (
            <button
              type="button"
              onClick={onRequestNearMe}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
              <span>Near Me</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Exit fullscreen map' : 'Expand map fullscreen'}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#e6ddd0] bg-white hover:border-[#b45309] text-[#1c1613] transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Explicit-Height Map Canvas */}
      <div className={`relative w-full ${isExpanded ? 'flex-1 min-h-0' : heightClassName}`}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={cameraCenter}
          defaultZoom={cameraZoom}
          gestureHandling="cooperative"
          onCameraChanged={handleCameraChanged}
          onClick={() => setSelectedId(null)}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraSync center={cameraCenter} zoom={cameraZoom} />

          {userLocation && (
            <AdvancedMarker position={userLocation} title="Your current location">
              <div className="w-4 h-4 rounded-full bg-[#2563eb] border-2 border-white shadow-md ring-4 ring-[#2563eb]/25" />
            </AdvancedMarker>
          )}

          {markerItems.map((item) => (
            <CafeMarkerPin
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              isDesktop={isDesktop}
              onSelect={() => setSelectedId(item.id)}
              onClose={() => setSelectedId(null)}
            />
          ))}
        </GoogleMap>

        {showSearchAreaCta && pannedCenter && onSearchThisArea && (
          <button
            type="button"
            onClick={() => {
              setLastSearchedCenter(pannedCenter);
              onSearchThisArea(pannedCenter);
            }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-full bg-white hover:bg-[#faf7f2] text-[#1c1613] border border-[#e6ddd0] shadow-md text-xs font-semibold whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
            <span>Search this area</span>
          </button>
        )}

        {onRequestNearMe && (
          <button
            type="button"
            onClick={onRequestNearMe}
            aria-label="Center map on my location"
            className={`absolute right-3 z-10 w-11 h-11 rounded-full bg-white border border-[#e6ddd0] shadow-md flex items-center justify-center text-[#1c1613] hover:border-[#b45309] transition-all ${
              selectedItem && !isDesktop ? 'bottom-44' : 'bottom-4'
            }`}
          >
            <LocateFixed className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
          </button>
        )}

        {selectedItem && !isDesktop && (
          <div className="md:hidden absolute inset-x-3 bottom-3 z-20 rounded-2xl bg-white border border-[#e6ddd0] shadow-xl p-3.5 space-y-2.5 animate-sheet-up">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#b45309] truncate">
                  {selectedItem.source === 'curated'
                    ? `${selectedItem.area} · Cafe Desk`
                    : `${selectedItem.area} · Google Maps`}
                </p>
                <h3 className="font-serif-display text-base font-bold text-[#1c1613] truncate">
                  {selectedItem.title}
                </h3>
                <p className="text-xs text-[#5c4e45] truncate">{selectedItem.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close cafe preview"
                className="w-9 h-9 rounded-lg border border-[#e6ddd0] text-[#5c4e45] hover:text-[#1c1613] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#1c1613] font-medium">
              {formatDistanceKm(selectedItem.distanceKm) && (
                <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-mono-data font-semibold">
                  <Navigation className="w-3 h-3" aria-hidden="true" />
                  {formatDistanceKm(selectedItem.distanceKm)}
                </span>
              )}
              {selectedItem.rating !== null && selectedItem.rating !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono-data font-semibold">
                  <Star className="w-3 h-3 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                  {selectedItem.rating}
                </span>
              )}
              {selectedItem.avgCost !== null && selectedItem.avgCost !== undefined && (
                <span className="font-mono-data">₹{selectedItem.avgCost} avg</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {selectedItem.slug && (
                <Link
                  to={getCafeDetailRoute(selectedItem.slug, authenticated)}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Explore Cafe</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}
              {authenticated && selectedItem.mapLink && (
                <a
                  href={selectedItem.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 rounded-xl border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] text-xs font-semibold inline-flex items-center justify-center gap-1"
                >
                  <span>Directions</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
