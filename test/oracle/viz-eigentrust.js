// Test oracle: the EigenTrust + simulation core of kumavis/raindrop-viz,
// extracted VERBATIM from the deployed production bundle
//   https://kumavis.github.io/raindrop-viz/assets/index-BHZePsPU.js
// on 2026-06-12 (repo is private; the bundle is the only public artifact).
// Minified identifiers are preserved deliberately as provenance — do not
// reformat or "clean up" this file; it is ground truth, not project code.
//
// Qg = eigentrust({trustMatrix, trustedSetWeights, alpha=0.15, initialState,
//                  errorThreshold=1e-6, maxIterations=1000, getDefaultsForRow})
// z3 = simulate({trustMatrix, initialBalances, alpha=0.15, issuanceAmount=10,
//                issuanceMode="fixed"|"percentage", rounds=10, burnRatio=0,
//                getDefaultsForRow})
// E3 = row-normalize (zero rows -> fallback), b3 = normalize, M3 = transpose,
// A3 = matrix-vector product, P3 = L2 distance.
// Zero-row fallback presets from the viz UI (Zd in the bundle):
//   TrustSet (library default): (i, p) => p
//   "Uniform (PageRank)":       (i, p) => p.map(() => 1 / p.length)
//   "Self-Trust" (UI default):  (i, p) => p.map((_, j) => i === j ? 1 : 0)

function Qg({trustMatrix:e,trustedSetWeights:n,alpha:r=.15,initialState:i,errorThreshold:o=1e-6,maxIterations:l=1e3,getDefaultsForRow:a}){const s=e.length;if(n.length!==s)throw new Error("Length of trustedSetWeights must match the number of peers in the network.");const u=b3(n),c=a||(()=>u),f=E3(e,y=>c(y,u));let h=i?[...i]:[...u],g=[...h],v=[h];const w=M3(f);let S=1/0,p=0;for(;S>o&&p<l;)h=A3(w,g).map((m,x)=>(1-r)*m+r*u[x]),S=P3(h,g),g=[...h],v.push(h),p++;return p>=l&&console.warn("Eigentrust algorithm did not converge within the maximum iterations."),{result:h,steps:v,iterations:p}}
function E3(e,n){return e.map((r,i)=>{const o=r.reduce((l,a)=>l+a,0);return o>0?r.map(l=>l/o):n(i)})}
function b3(e){const n=e.reduce((r,i)=>r+i,0);if(n<=0)throw new Error("Total weight of trusted set must be greater than 0.");return e.map(r=>r/n)}
function M3(e){return e[0].map((n,r)=>e.map(i=>i[r]))}
function A3(e,n){return e.map(r=>r.reduce((i,o,l)=>i+o*n[l],0))}
function P3(e,n){return Math.sqrt(e.reduce((r,i,o)=>r+Math.pow(i-n[o],2),0))}
function z3({trustMatrix:e,initialBalances:n,alpha:r=.15,issuanceAmount:i=10,issuanceMode:o="fixed",rounds:l=10,burnRatio:a=0,getDefaultsForRow:s=null,topologyChanges:u=[]}){const d=(typeof e=="function"?e(0):e).length;if(n.length!==d)throw new Error("Initial balances length must match trust matrix dimensions");if(a<0||a>1)throw new Error("Burn ratio must be between 0 and 1");const f=[],h=[],g=[];let v=[...n],w=v.reduce((S,p)=>S+p,0);f.push([...v]),g.push(w);for(let S=0;S<l;S++){const p=typeof e=="function"?e(S):e,y=Qg({trustMatrix:p,trustedSetWeights:v,alpha:r,getDefaultsForRow:s}),m=y.result;h.push({round:S,weights:[...m],iterations:y.iterations,eigentrustSteps:y.steps});let x;o==="percentage"?x=w*i:x=i;const _=x*(1-a);w+=_,v=v.map((C,E)=>C+m[E]*_),f.push([...v]),g.push(w)}return{balanceHistory:f,eigentrustHistory:h,totalSupplyHistory:g,finalBalances:v,finalTotalSupply:w,topologyChanges:u}}

export const oracleEigentrust = Qg;
export const oracleSimulate = z3;
export const oracleFallbacks = {
  trustSet: (i, p) => p,
  uniform: (i, p) => p.map(() => 1 / p.length),
  selfTrust: (i, p) => p.map((_, j) => (i === j ? 1 : 0)),
};
