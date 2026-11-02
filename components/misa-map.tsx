"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

type DealType = "매매" | "전세" | "월세";
type MapApartment = {
  id: number;
  name: string;
  dong: string;
  address: string;
  sale: number;
  jeonse: number;
  monthly: string;
  change: number;
  area: string;
  built: string;
  lat: number;
  lng: number;
};

type Props = {
  apartments: MapApartment[];
  selectedId: number;
  dealType: DealType;
  onSelect: (id: number) => void;
};

const pois = {
  transport: [
    { name: "미사역(5호선)", detail: "서울 도심·광화문 방향", lat: 37.5633, lng: 127.1928, icon: "5" },
    { name: "하남풍산역(5호선)", detail: "스타필드·하남시청 생활권", lat: 37.5521, lng: 127.2039, icon: "5" },
    { name: "미사역 광역버스 정류장", detail: "잠실·강남권 광역노선", lat: 37.5627, lng: 127.1915, icon: "B" },
    { name: "선동IC", detail: "서울양양고속도로 진입", lat: 37.5802, lng: 127.1921, icon: "IC" },
  ],
  school: [
    { name: "미사중앙초등학교", detail: "초등학교", lat: 37.5616, lng: 127.1892, icon: "초" },
    { name: "미사중학교", detail: "중학교", lat: 37.5584, lng: 127.1978, icon: "중" },
    { name: "미사고등학교", detail: "고등학교", lat: 37.5608, lng: 127.2021, icon: "고" },
    { name: "윤슬초등학교", detail: "초등학교", lat: 37.5709, lng: 127.1819, icon: "초" },
    { name: "풍산초등학교", detail: "초등학교", lat: 37.5508, lng: 127.1871, icon: "초" },
  ],
  commerce: [
    { name: "미사역 중심상권", detail: "병원·음식점·카페 밀집", lat: 37.5625, lng: 127.1932, icon: "상" },
    { name: "망월천 카페거리", detail: "수변 산책·카페거리", lat: 37.5672, lng: 127.1848, icon: "☕" },
    { name: "코스트코 하남점", detail: "대형마트", lat: 37.5601, lng: 127.2047, icon: "M" },
    { name: "스타필드 하남", detail: "쇼핑·문화·레저", lat: 37.5455, lng: 127.2234, icon: "★" },
    { name: "미사2동 행정복지센터", detail: "관공서", lat: 37.5663, lng: 127.1882, icon: "관" },
  ],
};

const line9Plan: [number, number][] = [
  [37.5706, 127.177],
  [37.5669, 127.184],
  [37.5633, 127.1928],
  [37.5588, 127.201],
  [37.5548, 127.211],
];

const selfSufficientDistrict: [number, number][] = [
  [37.5662, 127.204],
  [37.5717, 127.2055],
  [37.5736, 127.2138],
  [37.5668, 127.2162],
  [37.5637, 127.2092],
];

function money(value: number) {
  const eok = Math.floor(value / 10000);
  const rest = value % 10000;
  return `${eok}억${rest ? ` ${rest.toLocaleString()}` : ""}`;
}

function priceFor(apt: MapApartment, type: DealType) {
  return type === "매매" ? money(apt.sale) : type === "전세" ? money(apt.jeonse) : apt.monthly;
}

function apartmentIcon(rank: number, selected: boolean) {
  return L.divIcon({
    className: "misa-leaflet-div-icon",
    html: `<span class="apartment-pin${selected ? " is-selected" : ""}"><b>${rank}</b></span>`,
    iconSize: selected ? [46, 52] : [38, 44],
    iconAnchor: selected ? [23, 48] : [19, 40],
    popupAnchor: [0, -42],
  });
}

function poiIcon(label: string, category: "transport" | "school" | "commerce") {
  return L.divIcon({
    className: "misa-leaflet-div-icon",
    html: `<span class="poi-pin poi-${category}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function FlyToSelection({ apartment }: { apartment?: MapApartment }) {
  const map = useMap();
  useEffect(() => {
    if (apartment) map.flyTo([apartment.lat, apartment.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [apartment, map]);
  return null;
}

function MisaMapInner({ apartments, selectedId, dealType, onSelect }: Props) {
  const [layers, setLayers] = useState({ transport: true, school: true, commerce: true, development: true, radius: true });
  const selected = apartments.find((apt) => apt.id === selectedId) || apartments[0];
  const selectedPrice = selected ? priceFor(selected, dealType) : "-";
  const center = useMemo<[number, number]>(() => [37.5636, 127.1942], []);

  const toggle = (key: keyof typeof layers) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="detailed-map-shell">
      <MapContainer center={center} zoom={14} minZoom={12} maxZoom={19} zoomControl={false} className="detailed-map" preferCanvas>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ScaleControl imperial={false} position="bottomleft" />
        <FlyToSelection apartment={selected} />

        {layers.development && (
          <Pane name="development" style={{ zIndex: 410 }}>
            <Polyline positions={line9Plan} pathOptions={{ color: "#ad46ff", weight: 5, dashArray: "9 8", opacity: 0.8 }}>
              <Tooltip sticky>9호선 연장 검토축 · 관계기관 계획 확인 필요</Tooltip>
            </Polyline>
            <Polygon positions={selfSufficientDistrict} pathOptions={{ color: "#ef7d32", fillColor: "#f8b16d", fillOpacity: 0.2, weight: 2 }}>
              <Tooltip sticky>미사 자족시설·업무지구</Tooltip>
            </Polygon>
          </Pane>
        )}

        {selected && layers.radius && (
          <>
            <Circle center={[selected.lat, selected.lng]} radius={500} pathOptions={{ color: "#c08a27", fillColor: "#e2bd6c", fillOpacity: 0.08, weight: 1 }} />
            <Circle center={[selected.lat, selected.lng]} radius={1000} pathOptions={{ color: "#b6a071", fillColor: "transparent", dashArray: "6 6", weight: 1 }} />
          </>
        )}

        {apartments.map((apt, index) => (
          <Marker
            key={apt.id}
            position={[apt.lat, apt.lng]}
            icon={apartmentIcon(index + 1, apt.id === selectedId)}
            zIndexOffset={apt.id === selectedId ? 500 : 100}
            eventHandlers={{ click: () => onSelect(apt.id) }}
          >
            <Tooltip direction="top" offset={[0, -34]} opacity={0.94} permanent={apt.id === selectedId}>
              <b>{apt.name}</b>
            </Tooltip>
            <Popup minWidth={230}>
              <div className="map-popup">
                <small>{apt.dong} · {apt.built}년 · 전용 {apt.area}</small>
                <strong>{apt.name}</strong>
                <span>{apt.address}</span>
                <div><em>최근 {dealType}</em><b>{priceFor(apt, dealType)}</b></div>
                <button onClick={() => onSelect(apt.id)}>입지분석 보기</button>
              </div>
            </Popup>
          </Marker>
        ))}

        {layers.transport && pois.transport.map((poi) => (
          <Marker key={poi.name} position={[poi.lat, poi.lng]} icon={poiIcon(poi.icon, "transport")}>
            <Popup><div className="poi-popup"><b>{poi.name}</b><span>{poi.detail}</span></div></Popup>
          </Marker>
        ))}
        {layers.school && pois.school.map((poi) => (
          <Marker key={poi.name} position={[poi.lat, poi.lng]} icon={poiIcon(poi.icon, "school")}>
            <Popup><div className="poi-popup"><b>{poi.name}</b><span>{poi.detail}</span></div></Popup>
          </Marker>
        ))}
        {layers.commerce && pois.commerce.map((poi) => (
          <Marker key={poi.name} position={[poi.lat, poi.lng]} icon={poiIcon(poi.icon, "commerce")}>
            <Popup><div className="poi-popup"><b>{poi.name}</b><span>{poi.detail}</span></div></Popup>
          </Marker>
        ))}

        {layers.transport && <CircleMarker center={[37.5633, 127.1928]} radius={26} pathOptions={{ color: "#2360a5", fillOpacity: 0.08, weight: 1 }} />}
      </MapContainer>

      <div className="map-selected-card">
        <small>SELECTED COMPLEX</small>
        <strong>{selected?.name}</strong>
        <span>최근 {dealType} <b>{selectedPrice}</b></span>
      </div>

      <div className="map-layer-control" aria-label="지도 표시 레이어">
        <p>지도 레이어</p>
        {([
          ["transport", "교통", "#2360a5"],
          ["school", "학교", "#26744b"],
          ["commerce", "상권", "#b77912"],
          ["development", "개발계획", "#a247c5"],
          ["radius", "500m·1km", "#9b8352"],
        ] as const).map(([key, label, color]) => (
          <label key={key}>
            <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />
            <i style={{ backgroundColor: color }} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="map-legend"><span><i className="legend-apartment" />아파트</span><span><i className="legend-plan" />9호선 검토축</span><span><i className="legend-area" />자족시설지구</span></div>
      <a className="map-report" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">지도 오류 제보</a>
    </div>
  );
}

export default function MisaMapPortal(props: Props) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const mapTarget = document.querySelector("#top10 .relative.min-h-\\[520px\\]");
    if (!mapTarget) return;
    mapTarget.classList.add("has-detailed-map");
    setTarget(mapTarget);
    return () => mapTarget.classList.remove("has-detailed-map");
  }, []);

  return target ? createPortal(<MisaMapInner {...props} />, target) : null;
}
