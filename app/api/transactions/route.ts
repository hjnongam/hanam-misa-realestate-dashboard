import { NextRequest, NextResponse } from "next/server";

function decodeXml(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").trim()}
function field(block:string,names:string[]){for(const name of names){const match=block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,"i"));if(match)return decodeXml(match[1])}return ""}

export async function GET(request:NextRequest){
  const ym=request.nextUrl.searchParams.get("ym")?.replace(/\D/g,"")||"202610";
  if(!/^20\d{4}$/.test(ym))return NextResponse.json({ok:false,message:"올바른 조회월이 아닙니다."},{status:400});
  const key=process.env.PUBLIC_DATA_PORTAL_KEY;
  if(!key)return NextResponse.json({ok:false,source:"fallback",message:"API 키가 설정되지 않았습니다."});
  const url=`https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${key}&LAWD_CD=41450&DEAL_YMD=${ym}&numOfRows=999&pageNo=1`;
  try{
    const response=await fetch(url,{headers:{Accept:"application/xml"}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const xml=await response.text();
    if(xml.includes("SERVICE ERROR")||xml.includes("APPLICATION_ERROR"))throw new Error("공공데이터 응답 오류");
    const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
    const rows=blocks.map(block=>({apartment:field(block,["aptNm","아파트"]),dong:field(block,["umdNm","법정동"]),amount:Number(field(block,["dealAmount","거래금액"]).replace(/,/g,"")),area:Number(field(block,["excluUseAr","전용면적"])),floor:field(block,["floor","층"]),day:field(block,["dealDay","일"])})).filter(row=>row.apartment&&row.amount);
    const grouped=new Map<string,{apartment:string;dong:string;latest:number;count:number;area:number}>();
    for(const row of rows){const old=grouped.get(row.apartment);grouped.set(row.apartment,{apartment:row.apartment,dong:row.dong,latest:row.amount,count:(old?.count||0)+1,area:row.area||old?.area||0})}
    const top=[...grouped.values()].sort((a,b)=>b.latest-a.latest).slice(0,10);
    return NextResponse.json({ok:true,source:"국토교통부 공공데이터포털",ym,total:rows.length,top,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, max-age=900, s-maxage=1800"}});
  }catch(error){return NextResponse.json({ok:false,source:"fallback",message:error instanceof Error?error.message:"실거래 조회 실패"})}
}
