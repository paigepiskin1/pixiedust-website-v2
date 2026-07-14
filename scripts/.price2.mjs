const BASE="https://run.syncnode.ai", KEY=process.env.SYNCNODE_API_KEY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bal=async()=>{const r=await fetch(`${BASE}/balance?apiKey=${KEY}`,{headers:{Authorization:`Bearer ${KEY}`}});return (await r.json()).balance;};
const startImg="https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1781123323765.jpg";
const b0=await bal(); console.log("balance before:",b0);
const sub=await fetch(`${BASE}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:KEY,model:"kwaivgi/kling-v2.5-turbo-pro",input:{prompt:"Cinematic motion, warm rim light, soft grain.",start_image:startImg,aspect_ratio:"9:16",duration:5}})}).then(r=>r.json());
const jid=sub.job_id; console.log("job:",jid);
for(let i=0;i<55;i++){await sleep(6000);const d=await fetch(`${BASE}/prediction-status?job_id=${jid}&apiKey=${KEY}`,{headers:{Authorization:`Bearer ${KEY}`}}).then(r=>r.json());const st=String(d.replicate_status||d.status).toLowerCase();if(["succeeded","completed","failed","canceled"].includes(st)){console.log("done:",st);break;}}
await sleep(6000);
const b1=await bal(); console.log("balance after:",b1);
console.log("=== KLING 5s cost: $"+(b0-b1).toFixed(4)+" ===");
