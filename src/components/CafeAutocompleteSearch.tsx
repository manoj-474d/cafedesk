/// <reference types="google.maps" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { BENGALURU_CENTER } from '../config/constants';
import { useCms } from '../context/CmsContext';
import {
  checkGmpQuotaError,
  GMP_ATTRIBUTION_ID,
  useDiscovery,
} from '../context/DiscoveryContext';
import type { LocationItem } from '../types/cms';
import { formatDistanceKm } from '../utils/cafeHelpers';

interface CafeAutocompleteSearchProps {
  id?: string;
  value: string;
  onChange: (nextVal: string) => void;
  onSubmitQuery?: (queryText: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

export function CafeAutocompleteSearch({
  id = 'cafe-autocomplete-input',
  value,
  onChange,
  onSubmitQuery,
  placeholder = 'Search any Bengaluru cafe, area, tea, coffee, or "Third Wave Coffee"...',
  inputClassName = 'w-full h-11 pl-10 pr-9 rounded-lg border border-[#d6cbba] bg-white text-sm font-medium text-[#1c1613] placeholder:text-[#5c4e45]/60',
}: CafeAutocompleteSearchProps) {
  const navigate = useNavigate();
  const placesLib = useMapsLibrary('places');
  const { locations } = useCms();
  const { userLocation, getEffectiveLocation, resolvePredictionToPlace } = useDiscovery();

  const [open, setOpen] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // Curated local instant matches
  const curatedMatches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return locations
      .map((l) => getEffectiveLocation(l))
      .filter((loc) => {
        const hay = [
          loc.name,
          loc.area,
          loc.address,
          loc.popular_items.join(' '),
          loc.claims.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 4);
  }, [value, locations, getEffectiveLocation]);

  // Live Google Places Autocomplete suggestions across Bengaluru
  useEffect(() => {
    const trimmed = value.trim();
    if (!placesLib || trimmed.length < 2) {
      setLiveSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    setLoadingSuggestions(true);

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const hasCityWord = /bengaluru|bangalore/i.test(trimmed);
        const queryForAutocomplete = hasCityWord ? trimmed : `${trimmed} Bengaluru`;

        const request: google.maps.places.AutocompleteRequest = {
          input: queryForAutocomplete,
          sessionToken: sessionTokenRef.current,
          includedPrimaryTypes: ['cafe', 'coffee_shop', 'bakery', 'tea_house'],
          includedRegionCodes: ['in'],
          locationBias: {
            center: userLocation ?? BENGALURU_CENTER,
            radius: 32000,
          },
          origin: userLocation ?? BENGALURU_CENTER,
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        };

        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          setLiveSuggestions((res.suggestions ?? []).slice(0, 6));
        }
      } catch (err) {
        checkGmpQuotaError(err);
        if (!cancelled) setLiveSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, value, userLocation]);

  const handleSelectCurated = (loc: LocationItem) => {
    setOpen(false);
    sessionTokenRef.current = null;
    navigate(`/locations/${loc.slug}`);
  };

  const handleSelectPrediction = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    const predId = suggestion.placePrediction?.placeId || 'live';
    setResolvingId(predId);
    const resolved = await resolvePredictionToPlace(suggestion);
    sessionTokenRef.current = null; // Reset session token after fetchFields
    setResolvingId(null);
    setOpen(false);

    if (resolved) {
      navigate(`/locations/google:${encodeURIComponent(resolved.placeId)}`);
    } else if (onSubmitQuery) {
      onSubmitQuery(suggestion.placePrediction?.mainText?.text || value);
    }
  };

  const showDropdown =
    open &&
    value.trim().length >= 2 &&
    (curatedMatches.length > 0 || liveSuggestions.length > 0 || loadingSuggestions);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="w-4 h-4 text-[#5c4e45] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className={inputClassName}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setLiveSuggestions([]);
              sessionTokenRef.current = null;
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#5c4e45] hover:text-[#1c1613]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl bg-white border border-[#e6ddd0] shadow-xl overflow-hidden max-h-[420px] overflow-y-auto"
        >
          {/* Curated Matches */}
          {curatedMatches.length > 0 && (
            <div className="border-b border-[#e6ddd0]">
              <p className="px-3.5 py-1.5 bg-[#faf7f2] text-[10px] font-bold uppercase tracking-wider text-[#b45309]">
                Cafe Desk Directory Matches
              </p>
              {curatedMatches.map((loc) => {
                const thumb = loc.photos_approved && loc.photos.length > 0 ? loc.photos[0] : '';
                const dist = formatDistanceKm(loc.distanceKm);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectCurated(loc)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#faf7f2] flex items-center gap-3 transition-colors border-t border-[#f3ede3] first:border-t-0"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover border border-[#e6ddd0] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[#f3ede3] border border-[#e6ddd0] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#b45309]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#1c1613] truncate">
                          {loc.name}
                        </span>
                        {loc.verified && (
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="text-xs text-[#5c4e45] truncate">
                        {loc.area} · {loc.address}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {loc.rating !== null && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#1c1613]">
                          <Star className="w-3 h-3 text-[#d97706] fill-[#d97706]" />
                          {loc.rating.toFixed(1)}
                        </span>
                      )}
                      {dist && (
                        <p className="text-[11px] font-mono-data text-[#1b4d3e] font-semibold">
                          {dist}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Live Google Places Suggestions */}
          <div>
            <div className="px-3.5 py-1.5 bg-[#faf7f2] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1b4d3e]">
                Live Across Bengaluru (Google Maps)
              </span>
              {loadingSuggestions && (
                <Loader2 className="w-3 h-3 animate-spin text-[#1b4d3e]" />
              )}
            </div>

            {liveSuggestions.map((suggestion, idx) => {
              const pred = suggestion.placePrediction;
              if (!pred) return null;
              const mainTitle = pred.mainText?.text || pred.text?.text || 'Bengaluru Cafe';
              const secondary = pred.secondaryText?.text || 'Bengaluru, Karnataka';
              const distKm =
                typeof pred.distanceMeters === 'number'
                  ? formatDistanceKm(pred.distanceMeters / 1000)
                  : '';
              const isResolving = resolvingId === pred.placeId;

              return (
                <button
                  key={`${pred.placeId || idx}`}
                  type="button"
                  disabled={Boolean(resolvingId)}
                  onClick={() => handleSelectPrediction(suggestion)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#faf7f2] flex items-center gap-3 transition-colors border-t border-[#f3ede3]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center shrink-0">
                    {isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1b4d3e]" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#1b4d3e]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1c1613] truncate">{mainTitle}</p>
                    <p className="text-xs text-[#5c4e45] truncate">{secondary}</p>
                  </div>
                  {distKm && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-data font-semibold text-[#1b4d3e] shrink-0">
                      <Navigation className="w-3 h-3" aria-hidden="true" />
                      {distKm}
                    </span>
                  )}
                </button>
              );
            })}

            {!loadingSuggestions && liveSuggestions.length === 0 && placesLib && (
              <p className="px-3.5 py-2.5 text-xs text-[#5c4e45]">
                No extra autocomplete matches — press Search to query all Bengaluru cafes.
              </p>
            )}
          </div>

          {onSubmitQuery && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSubmitQuery(value.trim());
              }}
              className="w-full px-3.5 py-2.5 bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>Search all Bengaluru cafes for &ldquo;{value.trim()}&rdquo;</span>
              </span>
              <span>&rarr;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
