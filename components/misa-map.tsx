"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl, { type Map as MapLibreMap, type Marker as MapLibreMarker } from "maplibre-gl";
import type { Feature, LineString, Polygon } from "geojson";

type DealType = "매매" | "전세" | "월세";
type MapApartment = {
  id: number; name: string; dong: string; address: string; sale: number; jeonse: number; monthly: string;
  change: number; area: string; built: string; lat: number; lng: number;
};
type Props = { apartments: MapApartment[]; selectedId: number; dealType: DealType; onSelect: (id: number) => void };
type LayerKey = "transport" | "school" | "commerce" | "development" | "radius";
type MapStyleKey = "colorful" | "graybeard" | "eclipse";

const STYLE_OPTIONS: { key: MapStyleKey; label: string; url: string }[] = [
  { key: "colorful", label: "상세도로", url: "https://vector.openstreetmap.org/styles/shortbread/colorful.json" },
  { key: "graybeard", label: "밝은지도", url: "https://vector.openstreetmap.org/styles/shortbread/graybeard.json" },
  { key: "eclipse", label: "야간지도", url: "https://vector.openstreetmap.org/styles/shortbread/eclipse.json" },
];

const pois = {
  transport: [
    { name: "미사역(5호선)", detail: "서울 도심·광화문 방향", lat: 37.5633, lng: 127.1928, icon: "5" },
    { name: "하남풍산역(5호선)", detail: "스타필드·하남시청 생활권", lat: 37.5521, lng: 127.2039, icon: "5" },
    { name: "미사역 광역버스", detail: "잠실·강남권 광역노선", lat: 37.5627, lng: 127.1915, icon: "B" },
    { name: "선동IC", detail: "서울양양고속도로 진입", lat: 37.5802, lng: 127.1921, icon: "IC" },
  ],
  school: [
    { name: "미사중앙초", detail: "초등학교", lat: 37.5616, lng: 127.1892, icon: "초" },
    { name: "미사중", detail: "중학교", lat: 37.5584, lng: 127.1978, icon: "중" },
    { name: "미사고", detail: "고등학교", lat: 37.5608, lng: 127.2021, icon: "고" },
    { name: "윤슬초", detail: "초등학교", lat: 37.5709, lng: 127.1819, icon: "초" },
    { name: "풍산초", detail: "초등학교", lat: 37.5508, lng: 127.1871, icon: "초" },
  ],
  commerce: [
    { name: "미사역 중심상권", detail: "병원·음식점·카페 밀집", lat: 37.5625, lng: 127.1932, icon: "상" },
    { name: "망월천 카페거리", detail: "수변 산책·카페거리", lat: 37.5672, lng: 127.1848, icon: "☕" },
    { name: "코스트코 하남점", detail: "대형마트", lat: 37.5601, lng: 127.2047, icon: "M" },
    { name: "스타필드 하남", detail: "쇼핑·문화·레저", lat: 37.5455, lng: 127.2234, icon: "★" },
    { name: "미사2동 행정복지센터", detail: "관공서", lat: 37.5663, lng: 127.1882, icon: "관" },
  ],
};

const line9Plan: [number, number][] = [[127.177,37.5706],[127.184,37.5669],[127.1928,37.5633],[127.201,37.5588],[127.211,37.5548]];
const selfSufficientDistrict: [number, number][] = [[127.204,37.5662],[127.2055,37.5717],[127.2138,37.5736],[127.2162,37.5668],[127.2092,37.5637],[127.204,37.5662]];
const overlayLayerIds = ["misa-plan-line","misa-plan-area-fill","misa-plan-area-line","misa-radius-500-fill","misa-radius-500-line","misa-radius-1000-line"];
const overlaySourceIds = ["misa-plan-line-source","misa-plan-area-source","misa-radius-500-source","misa-radius-1000-source"];

function money(value: number) { const eok=Math.floor(value/10000),rest=value%10000; return `${eok}억${rest?` ${rest.toLocaleString()}`:""}`; }
function priceFor(apt: MapApartment,type: DealType) { return type==="매매"?money(apt.sale):type==="전세"?money(apt.jeonse):apt.monthly; }
function circleFeature(lng:number,lat:number,radiusMeters:number):Feature<Polygon>{
  const coordinates:[number,number][]=[],earthRadius=6371000;
  for(let i=0;i<=72;i+=1){const angle=(i/72)*Math.PI*2;const latOffset=(radiusMeters/earthRadius)*Math.cos(angle)*(180/Math.PI);const lngOffset=(radiusMeters/(earthRadius*Math.cos((lat*Math.PI)/180)))*Math.sin(angle)*(180/Math.PI);coordinates.push([lng+lngOffset,lat+latOffset]);}
  return {type:"Feature",properties:{radius:radiusMeters},geometry:{type:"Polygon",coordinates:[coordinates]}};
}
function popupContent(title:string,meta:string,price?:string){
  const node=document.createElement("div");node.className="vector-popup-content";
  const strong=document.createElement("strong");strong.textContent=title;const small=document.createElement("small");small.textContent=meta;node.append(strong,small);
  if(price){const em=document.createElement("em");em.textContent=price;node.append(em);}return node;
}
function clearOverlays(map:MapLibreMap){overlayLayerIds.forEach(id=>{if(map.getLayer(id))map.removeLayer(id)});overlaySourceIds.forEach(id=>{if(map.getSource(id))map.removeSource(id)});}

function MisaMapInner({apartments,selectedId,dealType,onSelect}:Props){
  const containerRef=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),markersRef=useRef<MapLibreMarker[]>([]),currentStyleRef=useRef<MapStyleKey>("colorful");
  const [styleKey,setStyleKey]=useState<MapStyleKey>("colorful"),[styleVersion,setStyleVersion]=useState(0),[mapError,setMapError]=useState(false);
  const [layers,setLayers]=useState<Record<LayerKey,boolean>>({transport:true,school:true,commerce:true,development:true,radius:true});
  const selected=apartments.find(apt=>apt.id===selectedId)||apartments[0],selectedPrice=selected?priceFor(selected,dealType):"-";

  const fitAll=useCallback((duration=600)=>{const map=mapRef.current;if(!map||apartments.length===0)return;const bounds=new maplibregl.LngLatBounds();apartments.forEach(apt=>bounds.extend([apt.lng,apt.lat]));const mobile=(containerRef.current?.clientWidth||700)<650;map.fitBounds(bounds,{padding:mobile?{top:105,right:38,bottom:175,left:38}:{top:100,right:190,bottom:70,left:55},maxZoom:15.7,duration});},[apartments]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=new maplibregl.Map({container:containerRef.current,style:STYLE_OPTIONS[0].url,center:[127.1942,37.5636],zoom:15,minZoom:12,maxZoom:19,attributionControl:false,cooperativeGestures:false});
    mapRef.current=map;map.addControl(new maplibregl.NavigationControl({visualizePitch:false}),"bottom-right");map.addControl(new maplibregl.ScaleControl({unit:"metric",maxWidth:100}),"bottom-left");map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'}),"bottom-right");
    const ready=()=>{setMapError(false);setStyleVersion(value=>value+1)};map.on("style.load",ready);map.on("error",event=>{const message=String(event.error?.message||"");if(/style|source|tile/i.test(message))setMapError(true)});map.once("load",()=>{fitAll(0);ready()});
    const readyTimer=window.setInterval(()=>{if(map.isStyleLoaded()){window.clearInterval(readyTimer);ready()}},120);
    return()=>{window.clearInterval(readyTimer);markersRef.current.forEach(marker=>marker.remove());markersRef.current=[];map.remove();mapRef.current=null};
  },[]);

  useEffect(()=>{const map=mapRef.current;if(!map||currentStyleRef.current===styleKey)return;currentStyleRef.current=styleKey;setMapError(false);map.setStyle(STYLE_OPTIONS.find(item=>item.key===styleKey)?.url||STYLE_OPTIONS[0].url);map.once("idle",()=>setStyleVersion(value=>value+1));},[styleKey]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;markersRef.current.forEach(marker=>marker.remove());markersRef.current=[];const styleLoaded=map.isStyleLoaded();if(styleLoaded)clearOverlays(map);
    if(styleLoaded&&layers.development){
      const line:Feature<LineString>={type:"Feature",properties:{name:"9호선 연장 검토축"},geometry:{type:"LineString",coordinates:line9Plan}};
      const area:Feature<Polygon>={type:"Feature",properties:{name:"미사 자족시설·업무지구"},geometry:{type:"Polygon",coordinates:[selfSufficientDistrict]}};
      map.addSource("misa-plan-line-source",{type:"geojson",data:line});map.addLayer({id:"misa-plan-line",type:"line",source:"misa-plan-line-source",paint:{"line-color":"#9b36cf","line-width":5,"line-opacity":.86,"line-dasharray":[1.8,1.6]}});
      map.addSource("misa-plan-area-source",{type:"geojson",data:area});map.addLayer({id:"misa-plan-area-fill",type:"fill",source:"misa-plan-area-source",paint:{"fill-color":"#f39a45","fill-opacity":.18}});map.addLayer({id:"misa-plan-area-line",type:"line",source:"misa-plan-area-source",paint:{"line-color":"#e87524","line-width":2.4}});
    }
    if(styleLoaded&&selected&&layers.radius){
      map.addSource("misa-radius-500-source",{type:"geojson",data:circleFeature(selected.lng,selected.lat,500)});map.addLayer({id:"misa-radius-500-fill",type:"fill",source:"misa-radius-500-source",paint:{"fill-color":"#d9a83b","fill-opacity":.08}});map.addLayer({id:"misa-radius-500-line",type:"line",source:"misa-radius-500-source",paint:{"line-color":"#bc8120","line-width":2}});
      map.addSource("misa-radius-1000-source",{type:"geojson",data:circleFeature(selected.lng,selected.lat,1000)});map.addLayer({id:"misa-radius-1000-line",type:"line",source:"misa-radius-1000-source",paint:{"line-color":"#836f49","line-width":1.5,"line-dasharray":[3,3]}});
    }
    apartments.forEach((apt,index)=>{
      const element=document.createElement("button");element.type="button";element.className=`vector-apt-marker${apt.id===selectedId?" is-selected":""}`;element.setAttribute("aria-label",`${apt.name} 지도 위치`);
      const rank=document.createElement("b");rank.textContent=String(index+1);element.append(rank);if(apt.id===selectedId){const label=document.createElement("span");label.textContent=apt.name;element.append(label)}element.addEventListener("click",()=>onSelect(apt.id));
      const popup=new maplibregl.Popup({offset:32,closeButton:false,className:"misa-vector-popup"}).setDOMContent(popupContent(apt.name,`${apt.dong} · ${apt.address} · ${apt.area}`,`최근 ${dealType} ${priceFor(apt,dealType)}`));
      markersRef.current.push(new maplibregl.Marker({element,anchor:"bottom"}).setLngLat([apt.lng,apt.lat]).setPopup(popup).addTo(map));
    });
    const addPoiMarkers=(items:typeof pois.transport,category:"transport"|"school"|"commerce")=>items.forEach(poi=>{const element=document.createElement("button");element.type="button";element.className=`vector-poi-marker poi-${category}`;element.textContent=poi.icon;element.setAttribute("aria-label",poi.name);const popup=new maplibregl.Popup({offset:20,closeButton:false,className:"misa-vector-popup"}).setDOMContent(popupContent(poi.name,poi.detail));markersRef.current.push(new maplibregl.Marker({element,anchor:"center"}).setLngLat([poi.lng,poi.lat]).setPopup(popup).addTo(map))});
    if(layers.transport)addPoiMarkers(pois.transport,"transport");if(layers.school)addPoiMarkers(pois.school,"school");if(layers.commerce)addPoiMarkers(pois.commerce,"commerce");
  },[apartments,dealType,layers,onSelect,selected,selectedId,styleVersion]);

  useEffect(()=>{const map=mapRef.current;if(!map||!selected||!map.isStyleLoaded())return;const mobile=(containerRef.current?.clientWidth||700)<650;map.flyTo({center:[selected.lng,selected.lat],zoom:Math.max(map.getZoom(),16),duration:850,padding:mobile?{top:100,right:25,bottom:170,left:25}:{top:90,right:180,bottom:55,left:45}});},[selected,styleVersion]);
  const toggle=(key:LayerKey)=>setLayers(current=>({...current,[key]:!current[key]}));
  const styleLabel=useMemo(()=>STYLE_OPTIONS.find(item=>item.key===styleKey)?.label||"상세도로",[styleKey]);

  return <div className="detailed-map-shell vector-map-shell">
    <div ref={containerRef} className="detailed-map vector-map" aria-label="미사지구 상세 벡터 지도"/>
    <div className="map-selected-card"><small>SELECTED COMPLEX</small><strong>{selected?.name}</strong><span>최근 {dealType} <b>{selectedPrice}</b></span></div>
    <div className="map-style-control" aria-label="지도 유형">{STYLE_OPTIONS.map(item=><button key={item.key} className={styleKey===item.key?"active":""} onClick={()=>setStyleKey(item.key)}>{item.label}</button>)}</div>
    <div className="map-layer-control" aria-label="지도 표시 레이어"><p>지도 레이어 <em>{styleLabel}</em></p>{([["transport","교통","#2360a5"],["school","학교","#26744b"],["commerce","상권","#b77912"],["development","개발계획","#a247c5"],["radius","500m·1km","#9b8352"]] as const).map(([key,label,color])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={()=>toggle(key)}/><i style={{backgroundColor:color}}/><span>{label}</span></label>)}<button className="fit-map-button" onClick={()=>fitAll()}>전체 단지 보기</button></div>
    <div className="map-legend"><span><i className="legend-apartment"/>아파트</span><span><i className="legend-plan"/>9호선 검토축</span><span><i className="legend-area"/>자족시설지구</span></div>
    {mapError&&<div className="map-error-note">상세 지도 연결을 다시 시도하고 있습니다.</div>}
    <a className="map-report" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">지도 오류 제보</a>
  </div>;
}

export default function MisaMapPortal(props:Props){const [target,setTarget]=useState<Element|null>(null);useEffect(()=>{const mapTarget=document.querySelector("#top10 .relative.min-h-\\[520px\\]");if(!mapTarget)return;mapTarget.classList.add("has-detailed-map");setTarget(mapTarget);return()=>mapTarget.classList.remove("has-detailed-map")},[]);return target?createPortal(<MisaMapInner {...props}/>,target):null;}
