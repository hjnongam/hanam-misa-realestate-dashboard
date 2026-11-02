import { NextRequest, NextResponse } from "next/server";

type TradeRow={apartment:string;dong:string;amount:number;area:number;floor:string;day:string;ym:string};

function decodeXml(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").trim()}
function field(block:string,names:string[]){for(const name of names){const match=block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,"i"));if(match)return decodeXml(match[1])}return ""}
function monthsEndingAt(ym:string,count:number){const year=Number(ym.slice(0,4)),month=Number(ym.slice(4,6));return Array.from({length:count},(_,index)=>{const date=new Date(Date.UTC(year,month-1-(count-1-index),1));return `${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,"0")}`})}
function monthLabel(ym:string){return `${Number(ym.slice(4,6))}월`}

async function fetchMonth(key:string,ym:string){
  const url=`https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${key}&LAWD_CD=41450&DEAL_YMD=${ym}&numOfRows=999&pageNo=1`;
  const response=await fetch(url,{headers:{Accept:"application/xml"}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const xml=await response.text();
  if(xml.includes("SERVICE ERROR")||xml.includes("APPLICATION_ERROR"))throw new Error("공공데이터 응답 오류");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]).map(block=>({
    apartment:field(block,["aptNm","아파트"]),dong:field(block,["umdNm","법정동"]),amount:Number(field(block,["dealAmount","거래금액"]).replace(/,/g,"")),area:Number(field(block,["excluUseAr","전용면적"])),floor:field(block,["floor","층"]),day:field(block,["dealDay","일"]),ym
  })).filter(row=>row.apartment&&row.amount) as TradeRow[];
}

export async function GET(request:NextRequest){
  const ym=request.nextUrl.searchParams.get("ym")?.replace(/\D/g,"")||"202610";
  const monthCount=Math.min(12,Math.max(1,Number(request.nextUrl.searchParams.get("months")||1)));
  if(!/^20\d{4}$/.test(ym))return NextResponse.json({ok:false,message:"올바른 조회월이 아닙니다."},{status:400});
  const key=process.env.PUBLIC_DATA_PORTAL_KEY;
  if(!key)return NextResponse.json({ok:false,source:"fallback",message:"API 키가 설정되지 않았습니다."});
  try{
    const monthKeys=monthsEndingAt(ym,monthCount),monthRows=await Promise.all(monthKeys.map(keyMonth=>fetchMonth(key,keyMonth))),rows=monthRows.flat(),latestRows=monthRows.at(-1)||[];
    const grouped=new Map<string,{apartment:string;dong:string;latest:number;count:number;area:number}>();
    for(const row of latestRows){const old=grouped.get(row.apartment);grouped.set(row.apartment,{apartment:row.apartment,dong:row.dong,latest:row.amount,count:(old?.count||0)+1,area:row.area||old?.area||0})}
    const dongMap=new Map<string,number>();for(const row of rows)dongMap.set(row.dong,(dongMap.get(row.dong)||0)+1);
    const top=[...grouped.values()].sort((a,b)=>b.latest-a.latest).slice(0,10);
    const monthly=monthKeys.map((keyMonth,index)=>({ym:keyMonth,label:monthLabel(keyMonth),count:monthRows[index].length}));
    const dongCounts=[...dongMap.entries()].map(([dong,count])=>({dong,count})).sort((a,b)=>b.count-a.count);
    return NextResponse.json({ok:true,source:"국토교통부 공공데이터포털",ym,total:latestRows.length,periodTotal:rows.length,monthly,dongCounts,top,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, max-age=900, s-maxage=1800"}});
  }catch(error){return NextResponse.json({ok:false,source:"fallback",message:error instanceof Error?error.message:"실거래 조회 실패"})}
}
