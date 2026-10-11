// Conservative label-based extraction. Never infer phase from load or solar capacity.
export function extractEBSummary(text:string){
 const normalized=text.replace(/\u00a0/g,' ').replace(/\r/g,'');
 const phaseMatch=normalized.match(/(?:connection\s+)?phase\s*[:\-]?\s*(single|three|1|3)(?:\s*[- ]?\s*phase)?\b/i)||normalized.match(/\b(single|three)[ -]phase\b/i);
 const loadMatch=normalized.match(/(?:sanctioned|connected|contracted)\s+load(?:\s*\(\s*(kW|W|kVA|HP)\s*\))?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(kW|W|kVA|HP)?\b/i);
 const usageMatch=normalized.match(/(?:total\s+)?(?:consumption|units\s+consumed)(?:\s*\([^)]*\))?\s*[:\-]?\s*(\d+(?:\.\d+)?)\b/i);
 const unit=(loadMatch?.[3]||loadMatch?.[1]||'').toLowerCase();
 // No unit conversion from HP or kVA, and no assumption for unlabeled units.
 const load=loadMatch&&['kw','w'].includes(unit)?String(Number(loadMatch[2])/(unit==='w'?1000:1)):'';
 return {phase:phaseMatch?(/^(single|1)$/i.test(phaseMatch[1])?'single':'three'):'unknown',load,usage:usageMatch?.[1]||'',evidence:[phaseMatch?.[0],loadMatch?.[0],usageMatch?.[0]].filter(Boolean) as string[],loadNeedsReview:!!loadMatch&&!load};
}
