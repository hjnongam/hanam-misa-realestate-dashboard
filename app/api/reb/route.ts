import { NextRequest, NextResponse } from "next/server";

export async function GET(request:NextRequest){
  const key=process.env.REB_API_KEY;
  if(!key)return NextResponse.json({ok:false,message:"R-ONE API 키가 설정되지 않았습니다."});
  const year=request.nextUrl.searchParams.get("year")?.replace(/\D/g,"")||"2026";
  const params=new URLSearchParams({KEY:key,Type:"json",STATBL_ID:"A_2024_00903",DTACYCLE_CD:"MM",CLS_ID:"500001",ITM_ID:"100001",START_WRTTIME:year,pIndex:"1",pSize:"24"});
  try{
    const response=await fetch(`https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?${params}`,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json() as Record<string,unknown>;
    return NextResponse.json({ok:true,source:"한국부동산원 R-ONE",table:"월간 지역별 지가변동률 참고지표",data,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, max-age=1800, s-maxage=3600"}});
  }catch(error){return NextResponse.json({ok:false,source:"fallback",message:error instanceof Error?error.message:"R-ONE 조회 실패"})}
}
