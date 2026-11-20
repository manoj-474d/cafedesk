import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { ArrowUpRight, Coffee, LocateFixed, MapPin, Navigation, Star, Wifi } from 'lucide-react';
import { BENGALURU_AREAS, BENGALURU_CENTER } from '../config/constants';
import type { LocationItem } from '../types/cms';
import type { GoogleDiscoveryCafe, LatLngPoint } from '../context/DiscoveryContext';
import { formatDistanceKm } from '../utils/cafeHelpers';
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
  onSelect,
  onClose,
}: {
  item: MapMarkerItem;
  selected: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
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

      {selected && marker && (
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
                <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-semibold">
                  <Navigation className="w-3 h-3" aria-hidden="true" />
                  {distText}
                </span>
              )}
              {item.rating !== null && item.rating !== undefined && (
                <span className="inline-flex items-center gap-0.5 font-semibold">
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
                  to={`/locations/${item.slug}`}
                  className="font-semibold text-[#b45309] hover:underline"
                >
                  View Details &rarr;
                </Link>
              ) : (
                <span className="text-[11px] text-[#5c4e45]">Nearby cafe</span>
              )}
              <a
                href={item.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-[#1c1613] hover:text-[#b45309]"
              >
                <span>Directions</span>
                <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
              </a>
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
}: InteractiveCafeMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="rounded-2xl border border-[#e6ddd0] bg-[#f3ede3] p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
              Bengaluru Map Explorer
            </p>
            <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
              Open neighborhood cafes directly in Google Maps
            </h3>
          </div>
          {onRequestNearMe && (
            <button
              type="button"
              onClick={onRequestNearMe}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#1b4d3e] text-white text-xs font-semibold"
            >
              <LocateFixed className="w-4 h-4" aria-hidden="true" />
              <span>Use My Location</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {BENGALURU_AREAS.slice(0, 8).map((areaName) => (
            <a
              key={areaName}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `cafes in ${areaName} Bengaluru`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#d6cbba] text-xs font-semibold text-[#1c1613] hover:border-[#b45309]"
            >
              <MapPin className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>{areaName}</span>
              <ArrowUpRight className="w-3 h-3 text-[#5c4e45]" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#e6ddd0] bg-white overflow-hidden shadow-sm">
      {/* Map Controls Strip */}
      <div className="px-4 py-3 bg-[#faf7f2] border-b border-[#e6ddd0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1c1613]">
            <Coffee className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
            <span>{markerItems.length} pinned cafes</span>
          </span>
          <span className="text-[#5c4e45] hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-1 text-[#5c4e45]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#b45309] inline-block" />
            Curated
          </span>
          <span className="inline-flex items-center gap-1 text-[#5c4e45]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b4d3e] inline-block" />
            Live Nearby
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSelectArea && (
            <select
              aria-label="Jump map to Bengaluru area"
              value={selectedArea}
              onChange={(e) => onSelectArea(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#d6cbba] bg-white text-xs font-semibold text-[#1c1613]"
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
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
              <span>Near Me</span>
            </button>
          )}
        </div>
      </div>

      {/* Explicit-Height Map Canvas (Required by Google Maps Platform SDK) */}
      <div className={`w-full ${heightClassName}`}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={cameraCenter}
          defaultZoom={cameraZoom}
          gestureHandling="cooperative"
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
              onSelect={() => setSelectedId(item.id)}
              onClose={() => setSelectedId(null)}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}
