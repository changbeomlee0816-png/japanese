import { useEffect, useRef, useState } from 'react';
import type { LatLng, PlaceRef } from '../types';
import { placeRefFromHit, suggestPlaces, mapsLoaded, type PlaceHit } from '../lib/maps';
import { Icon } from './Icon';

interface Props {
  initialQuery?: string;
  bias?: LatLng;
  onPick: (place: PlaceRef) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

/** 장소 검색 입력 + 후보 목록. 키가 없으면 내장 사전에서 찾는다. */
export function PlaceSearch({ initialQuery = '', bias, onPick, autoFocus, placeholder }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      const result = await suggestPlaces(query, bias);
      setHits(result);
      setLoading(false);
      setSearched(true);
    }, 350);
    return () => window.clearTimeout(timer.current);
  }, [query, bias]);

  return (
    <div className="place-search">
      <div className="search-bar">
        <Icon name="search" size={17} strokeWidth={2.2} color="var(--label-2)" />
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? '장소 이름이나 주소'}
          autoFocus={autoFocus}
          enterKeyHint="search"
        />
        {loading && <span className="spinner" />}
        {!loading && query && (
          <button type="button" onClick={() => setQuery('')} aria-label="지우기">
            <Icon name="close" size={16} strokeWidth={2.4} color="var(--label-3)" />
          </button>
        )}
      </div>

      {!mapsLoaded() && (
        <p className="muted tiny" style={{ padding: '8px 4px 0' }}>
          구글맵 키가 없어 내장 장소 사전에서만 찾습니다. 설정에서 키를 넣으면 전 세계 장소를 검색합니다.
        </p>
      )}

      {hits.length > 0 && (
        <ul className="place-hits">
          {hits.map((hit, i) => (
            <li key={`${hit.placeId}-${i}`}>
              <button type="button" onClick={() => onPick(placeRefFromHit(hit))}>
                <Icon name="pin" size={18} strokeWidth={1.9} color="var(--blue)" />
                <span>
                  <strong>{hit.name}</strong>
                  {hit.address && <em className="muted small">{hit.address}</em>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !loading && hits.length === 0 && (
        <p className="muted small" style={{ padding: '14px 4px' }}>
          검색 결과가 없습니다. 이름을 조금 더 정확히 적어보세요.
        </p>
      )}
    </div>
  );
}
