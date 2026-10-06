import type {TurnObservationView} from './index.js';
import type {BodySegment} from '../stream/presentation.js';
const PAGE_CHARACTERS=2000;
/** Display-only slicing: source text/digests stay untouched. No full-body concatenation. */
export function observationPage(view:TurnObservationView): {page:number;pages:number;segments:BodySegment[];text:string|null} {
  const detail=view.panel==='reply'||view.panel==='detail'?view.detail:null;
  const total=detail?detail.text.length:view.segments.reduce((sum,segment)=>sum+segment.text.length,0);
  const pages=Math.max(1,Math.ceil(total/PAGE_CHARACTERS)),page=Math.min(view.textPage??pages,pages);
  let from=(page-1)*PAGE_CHARACTERS,to=page*PAGE_CHARACTERS;
  const slice=(text:string)=>{
    let start=Math.max(0,from),end=Math.min(text.length,to);
    // Do not show half a UTF-16 surrogate at a display-page boundary.
    if(start>0&&/[\uDC00-\uDFFF]/.test(text[start]??''))start--;
    if(end<text.length&&/[\uDC00-\uDFFF]/.test(text[end]??''))end--;
    return text.slice(start,end);
  };
  if(detail)return {page,pages,segments:[],text:slice(detail.text)};
  const segments:BodySegment[]=[];
  for(const segment of view.segments){if(to>0&&from<segment.text.length)segments.push({...segment,text:slice(segment.text)});from-=segment.text.length;to-=segment.text.length;if(to<=0)break;}
  return {page,pages,segments,text:null};
}
