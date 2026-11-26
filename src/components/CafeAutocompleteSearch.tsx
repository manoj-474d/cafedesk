/// <reference types="google.maps" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import { BENGALURU_CENTER } from '../config/constants';
import { resolveApiUrl, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  checkGmpQuotaError,
  GMP_ATTRIBUTION_ID,
  useDiscovery,
} from '../context/DiscoveryContext';
import type { LocationItem } from '../types/cms';
import { formatDistanceKm, getCafeDetailRoute } from '../utils/cafeHelpers';

const RECENT_SEARCHES_KEY = 'cafedesk_recent_searches_v1';
const POPULAR_SEARCHES = [
  'Coffee in Indiranagar',
  'Tea shops near me',
  'Bakeries in Jayanagar',
  'Snacks in Koramangala',
  'Study cafes HSR Layout',
];

interface UnifiedSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  distanceMeters?: number | null;
  sdkSuggestion?: google.maps.places.AutocompleteSuggestion;
}

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function writeRecentSearch(term: string) {
  const clean = term.trim();
  if (clean.length < 2) return;
  try {
    const existing = readRecentSearches().filter(
      (item) => item.toLowerCase() !== clean.toLowerCase()
    );
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([clean, ...existing].slice(0, 5)));
  } catch {
    // Ignore storage errors
  }
}

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
  placeholder = 'Search cafes, tea shops, bakeries, snacks, or any locality...',
  inputClassName = 'w-full h-12 pl-10 pr-10 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] placeholder:text-[#8c7a6b] focus:border-[#b45309]',
}: CafeAutocompleteSearchProps) {
  const navigate = useNavigate();
  const placesLib = useMapsLibrary('places');
  const { authenticated } = useAuth();
  const { locations } = useCms();
  const { userLocation, getEffectiveLocation, resolvePredictionToPlace } = useDiscovery();

  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [liveSuggestions, setLiveSuggestions] = useState<UnifiedSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const saveTerm = (term: string) => {
    writeRecentSearch(term);
    setRecentSearches(readRecentSearches());
  };

  const curatedMatches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return locations
      .map((l) => getEffectiveLocation(l))
      .filter((loc) => {
        const hay = [
          loc.name,
          loc.area,
          loc.city,
          loc.category || '',
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

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setLiveSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    setLoadingSuggestions(true);

    const timer = window.setTimeout(async () => {
      try {
        // Primary path: Backend Google Places Autocomplete proxy
        const res = await fetch(resolveApiUrl('/api/places/autocomplete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: trimmed,
            lat: userLocation?.lat ?? null,
            lng: userLocation?.lng ?? null,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            suggestions?: Array<{
              placeId: string;
              mainText: string;
              secondaryText: string;
              distanceMeters?: number | null;
            }>;
          };
          if (!cancelled && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setLiveSuggestions(data.suggestions.slice(0, 6));
            setLoadingSuggestions(false);
            return;
          }
        }
      } catch {
        // Fallback to JS SDK below
      }

      if (!placesLib) {
        if (!cancelled) {
          setLiveSuggestions([]);
          setLoadingSuggestions(false);
        }
        return;
      }

      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
          locationBias: {
            center: userLocation ?? BENGALURU_CENTER,
            radius: 35000,
          },
          origin: userLocation ?? BENGALURU_CENTER,
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        };

        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          const mapped: UnifiedSuggestion[] = (res.suggestions ?? [])
            .map((s) => ({
              placeId: s.placePrediction?.placeId || '',
              mainText: s.placePrediction?.mainText?.text || s.placePrediction?.text?.text || '',
              secondaryText: s.placePrediction?.secondaryText?.text || '',
              distanceMeters: s.placePrediction?.distanceMeters ?? null,
              sdkSuggestion: s,
            }))
            .filter((s) => Boolean(s.placeId && s.mainText));
          setLiveSuggestions(mapped.slice(0, 6));
        }
      } catch (err) {
        checkGmpQuotaError(err);
        if (!cancelled) setLiveSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, value, userLocation]);

  const handleSelectCurated = (loc: LocationItem) => {
    saveTerm(loc.name);
    setOpen(false);
    sessionTokenRef.current = null;
    navigate(getCafeDetailRoute(loc.slug, authenticated));
  };

  const handleSelectPrediction = async (suggestion: UnifiedSuggestion) => {
    const predId = suggestion.placeId;
    const label = suggestion.mainText || value;
    saveTerm(label);
    setResolvingId(predId);

    if (suggestion.sdkSuggestion) {
      const resolved = await resolvePredictionToPlace(suggestion.sdkSuggestion);
      sessionTokenRef.current = null;
      setResolvingId(null);
      setOpen(false);
      if (resolved) {
        navigate(getCafeDetailRoute(`google:${encodeURIComponent(resolved.placeId)}`, authenticated));
        return;
      }
    }

    sessionTokenRef.current = null;
    setResolvingId(null);
    setOpen(false);
    if (predId) {
      navigate(getCafeDetailRoute(`google:${encodeURIComponent(predId)}`, authenticated));
    } else if (onSubmitQuery) {
      onSubmitQuery(label);
    }
  };

  const handleSelectQuickTerm = (term: string) => {
    saveTerm(term);
    onChange(term);
    setOpen(false);
    if (onSubmitQuery) {
      onSubmitQuery(term);
    } else {
      navigate(`/discover?q=${encodeURIComponent(term)}&live=1`);
    }
  };

  const trimmedLen = value.trim().length;
  const showQuickHistory = open && trimmedLen < 2;
  const showLiveResults =
    open &&
    trimmedLen >= 2 &&
    (curatedMatches.length > 0 || liveSuggestions.length > 0 || loadingSuggestions);
  const showDropdown = showQuickHistory || showLiveResults;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="w-4 h-4 text-[#8c7a6b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl text-[#8c7a6b] hover:text-[#1c1613]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showQuickHistory && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-white border border-[#e6ddd0] shadow-xl overflow-hidden max-h-[60vh] sm:max-h-[420px] overflow-y-auto"
        >
          {recentSearches.length > 0 && (
            <div className="border-b border-[#e6ddd0]">
              <div className="px-3.5 py-2 bg-[#faf7f2] flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5c4e45]">
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                    setRecentSearches([]);
                  }}
                  className="text-[11px] font-medium text-[#b45309] hover:underline py-1"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSelectQuickTerm(term)}
                  className="w-full text-left px-3.5 min-h-[44px] py-2 hover:bg-[#faf7f2] flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#1c1613] border-t border-[#f3ede3] first:border-t-0"
                >
                  <Clock className="w-3.5 h-3.5 text-[#8c7a6b] shrink-0" aria-hidden="true" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="px-3.5 py-2 bg-[#faf7f2] text-[10px] font-semibold uppercase tracking-wider text-[#b45309]">
              Popular Local Searches
            </p>
            <div className="p-2.5 flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSelectQuickTerm(term)}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full bg-[#faf7f2] hover:bg-[#fef3c7] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors"
                >
                  <TrendingUp className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLiveResults && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-white border border-[#e6ddd0] shadow-xl overflow-hidden max-h-[60vh] sm:max-h-[420px] overflow-y-auto"
        >
          {/* Curated Matches */}
          {curatedMatches.length > 0 && (
            <div className="border-b border-[#e6ddd0]">
              <p className="px-3.5 py-2 bg-[#faf7f2] text-[10px] font-semibold uppercase tracking-wider text-[#b45309]">
                CafeDesk Directory Matches
              </p>
              {curatedMatches.map((loc) => {
                const thumb = loc.photos_approved && loc.photos.length > 0 ? loc.photos[0] : '';
                const dist = formatDistanceKm(loc.distanceKm);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectCurated(loc)}
                    className="w-full text-left px-3.5 py-2.5 min-h-[52px] hover:bg-[#faf7f2] flex items-center gap-3 transition-colors border-t border-[#f3ede3] first:border-t-0"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-[#e6ddd0] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#fef3c7] border border-[#e6ddd0] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#b45309]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[#1c1613] truncate">
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
            <div className="px-3.5 py-2 bg-[#faf7f2] flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1b4d3e]">
                Live Places (Google Maps)
              </span>
              {loadingSuggestions && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1b4d3e]" />
              )}
            </div>

            {liveSuggestions.map((suggestion, idx) => {
              const distKm =
                typeof suggestion.distanceMeters === 'number'
                  ? formatDistanceKm(suggestion.distanceMeters / 1000)
                  : '';
              const isResolving = resolvingId === suggestion.placeId;

              return (
                <button
                  key={`${suggestion.placeId}-${idx}`}
                  type="button"
                  disabled={Boolean(resolvingId)}
                  onClick={() => void handleSelectPrediction(suggestion)}
                  className="w-full text-left px-3.5 py-2.5 min-h-[52px] hover:bg-[#faf7f2] flex items-center gap-3 transition-colors border-t border-[#f3ede3]"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center shrink-0">
                    {isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1b4d3e]" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#1b4d3e]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1c1613] truncate">
                      {suggestion.mainText}
                    </p>
                    <p className="text-xs text-[#5c4e45] truncate">
                      {suggestion.secondaryText || 'India'}
                    </p>
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

            {!loadingSuggestions && liveSuggestions.length === 0 && (
              <p className="px-3.5 py-2.5 text-xs text-[#5c4e45]">
                No instant suggestions — press Search to discover local places.
              </p>
            )}
          </div>

          {onSubmitQuery && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                saveTerm(value.trim());
                onSubmitQuery(value.trim());
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#faf7f2] hover:bg-[#fef3c7] text-[#b45309] border-t border-[#e6ddd0] text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search local places for &ldquo;{value.trim()}&rdquo;</span>
              </span>
              <span>&rarr;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
