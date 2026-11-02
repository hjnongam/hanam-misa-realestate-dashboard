import { NextResponse } from "next/server";

type RebRow={WRTTIME_IDTFR_ID?:string;GRP_ID?:number;GRP_NM?:string;GRP_FULLNM?:string;CLS_ID?:number;CLS_NM?:string;ITM_ID?:number;DTA_VAL?:number};

function rowsOf(data:Record<string,unknown>,root:string){
  const blocks=data[root];
  if(!Array.isArray(blocks))return [] as RebRow[];
  const rowBlock=blocks.find(block=>block&&typeof block==="object"&&"row" in (block as Record<string,unknown>)) as {row?:RebRow[]}|undefined;
  return rowBlock?.row||[];
}

export async function GET(){
  const key=process.env.REB_API_KEY;
  if(!key)return NextResponse.json({ok:false,source:"fallback",message:"R-ONE API 키가 설정되지 않았습니다."});
  const base="https://www.reb.or.kr/r-one/openapi/";
  try{
    const itemParams=new URLSearchParams({KEY:key,Type:"json",STATBL_ID:"A_2024_00609",ITM_TAG:"그룹",pIndex:"1",pSize:"1000"});
    const itemResponse=await fetch(`${base}SttsApiTblItm.do?${itemParams}`,{headers:{Accept:"application/json"}});
    if(!itemResponse.ok)throw new Error(`항목 조회 HTTP ${itemResponse.status}`);
    const itemData=await itemResponse.json() as Record<string,unknown>;
    const groupRows=rowsOf(itemData,"SttsApiTblItm") as Array<RebRow&{ITM_NM?:string;ITM_FULLNM?:string}>;
    const hanam=groupRows.find(row=>row.ITM_NM==="하남시"||row.ITM_FULLNM?.includes("하남시"));
    if(!hanam?.ITM_ID)throw new Error("하남시 통계 분류를 찾지 못했습니다.");
    const dataParams=new URLSearchParams({KEY:key,Type:"json",STATBL_ID:"A_2024_00609",DTACYCLE_CD:"MM",GRP_ID:String(hanam.ITM_ID),ITM_ID:"100001",START_WRTTIME:"2017",END_WRTTIME:"2026",pIndex:"1",pSize:"1000"});
    const dataResponse=await fetch(`${base}SttsApiTblData.do?${dataParams}`,{headers:{Accept:"application/json"}});
    if(!dataResponse.ok)throw new Error(`통계 조회 HTTP ${dataResponse.status}`);
    const data=await dataResponse.json() as Record<string,unknown>,rows=rowsOf(data,"SttsApiTblData");
    const annual=new Map<string,{total:number;local:number;gyeonggi:number;seoul:number;other:number}>();
    for(const row of rows){const year=String(row.WRTTIME_IDTFR_ID||"").slice(0,4);if(!year)continue;const item=annual.get(year)||{total:0,local:0,gyeonggi:0,seoul:0,other:0},value=Number(row.DTA_VAL)||0;if(row.CLS_ID===500001)item.total+=value;else if(row.CLS_ID===500002)item.local+=value;else if(row.CLS_ID===500003)item.gyeonggi+=value;else if(row.CLS_ID===500004)item.seoul+=value;else if(row.CLS_ID===500005)item.other+=value;annual.set(year,item)}
    const history=[...annual.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([year,value])=>({year,...value,externalPct:value.total?Number((((value.gyeonggi+value.seoul+value.other)/value.total)*100).toFixed(1)):0,seoulPct:value.total?Number(((value.seoul/value.total)*100).toFixed(1)):0}));
    if(!history.length)throw new Error("외지인 수요 통계가 비어 있습니다.");
    return NextResponse.json({ok:true,source:"한국부동산원 R-ONE",table:"(월) 매입자거주지별 아파트매매거래현황",scope:"하남시",history,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=21600"}});
  }catch(error){return NextResponse.json({ok:false,source:"fallback",message:error instanceof Error?error.message:"외지인 수요 조회 실패"})}
}
