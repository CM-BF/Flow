export const hostApiMajor=1;
export function invoke({input}) {
 const value=JSON.parse(input); let parsed, verdict;
 try { parsed=JSON.parse(value.source.content); } catch { verdict={result:'failed',reason:'invalid-json',missingKeys:[]}; }
 if(!verdict) { if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed)) verdict={result:'failed',reason:'not-object',missingKeys:[]};
 else { const missingKeys=value.rule.requiredKeys.filter(key=>!Object.hasOwn(parsed,key)); verdict=missingKeys.length?{result:'failed',reason:'missing-required-keys',missingKeys}:{result:'passed',reason:'passed',missingKeys:[]}; } }
 
 return JSON.stringify({schemaVersion:1,algorithmId:value.rule.algorithmId,algorithmVersion:1,inputDigest:value.inputDigest,verdict});
}
