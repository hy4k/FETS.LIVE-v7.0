export type Tool={name:string;description:string;parameters:Record<string,any>};
type Options={provider:'gemini'|'claude';model:string;key:string;system:string;history:{role:string;content:string}[];message:string;tools:Tool[];maxIterations:number;execute:(name:string,args:Record<string,unknown>)=>Promise<any>;fetcher?:typeof fetch};
function schema(value:any):any{if(Array.isArray(value))return value.map(schema);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='type'&&typeof v==='string'?v.toLowerCase():schema(v)]));return value;}
export async function providerRequest(url:string,headers:Record<string,string>,body:unknown,key:string,fetcher=fetch){
 let response:Response;
 try{response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});}catch(e){throw new Error((e as Error).name==='TimeoutError'?'The model took too long to respond. Saved actions remain recorded. Try a narrower question.':'The model connection failed. Please retry.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const detail=String(data?.error?.message||'').replaceAll(key,'[redacted]').slice(0,300);throw new Error(response.status===429?'AI provider usage limit reached. Please try again shortly.':`AI provider request failed (${response.status}): ${detail||'Check the selected model and server configuration.'}`);}
 return data;
}
export async function generateAnswer(options:Options){
 const {provider,model,key,system,message,tools,execute}=options;
 if(!key)throw new Error(`The selected ${provider==='claude'?'Claude':'Gemini'} provider has no server credential configured.`);
 const history=options.history.filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:m.content.slice(0,12000)}));
 const contents:any[]=provider==='gemini'?history.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})):history.map(m=>({role:m.role,content:m.content}));
 contents.push(provider==='gemini'?{role:'user',parts:[{text:message}]}:{role:'user',content:message});
 const evidence:any[]=[],proposals:any[]=[],actions:any[]=[];
 const result=(text:string)=>({text,evidence,proposals,actions,model,provider});let count=0;
 try{
  for(let turn=0;turn<options.maxIterations;turn++){
   const data=provider==='gemini'
    ?await providerRequest(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{'x-goog-api-key':key},{systemInstruction:{parts:[{text:system}]},contents,tools:[{functionDeclarations:tools}],generationConfig:{maxOutputTokens:4096}},key,options.fetcher)
    :await providerRequest('https://api.anthropic.com/v1/messages',{'x-api-key':key,'anthropic-version':'2023-06-01'},{model,system,messages:contents,max_tokens:4096,tools:tools.map(t=>({name:t.name,description:t.description,input_schema:schema(t.parameters)}))},key,options.fetcher);
   const content=provider==='gemini'?data.candidates?.[0]?.content:{role:'assistant',content:data.content};
   const parts=provider==='gemini'?content?.parts:content?.content;
   if(!Array.isArray(parts))throw new Error('The model returned no usable answer. Please retry.');
   const calls=parts.filter((p:any)=>provider==='gemini'?Boolean(p.functionCall):p.type==='tool_use');
   if(!calls.length){const text=parts.filter((p:any)=>p.text&&!p.thought).map((p:any)=>p.text).join('\n');return result(text||'I could not produce an answer. Try a more specific question.');}
   // Keep the complete response, including Gemini thought signatures and Claude blocks.
   contents.push(content);const answers:any[]=[];
   for(const part of calls){
    if(++count>24)return result('I reached this request’s lookup limit. Review any completed actions below, then narrow the request.');
    const call=provider==='gemini'?part.functionCall:{id:part.id,name:part.name,args:part.input};let outcome:any;
    try{outcome=await execute(call.name,call.args||{});}catch(e){outcome={error:(e as Error).message};}
    if(outcome.type==='action-result')actions.push(outcome);
    else if(outcome.type)proposals.push(outcome);
    if(outcome.source)evidence.push({source:outcome.source,page:outcome.page,available:outcome.available,fetchedAt:outcome.fetchedAt,truncated:outcome.truncated,count:outcome.records?.length,documents:outcome.documents});
    if(JSON.stringify(outcome).length>50000)outcome={available:false,error:'Result too large. Narrow the query; do not summarise unseen records.'};
    answers.push(provider==='gemini'?{functionResponse:{name:call.name,...(call.id?{id:call.id}:{}),response:outcome}}:{type:'tool_result',tool_use_id:call.id,content:JSON.stringify(outcome),...(outcome.error?{is_error:true}:{})});
   }
   contents.push(provider==='gemini'?{role:'user',parts:answers}:{role:'user',content:answers});
  }
  return result('The request reached its tool limit. Completed actions are shown below; ask a narrower follow-up for the remaining work.');
 }catch(e){if(actions.some(a=>a.status==='succeeded'))return result(`The saved actions below completed. I could not finish the explanation: ${(e as Error).message}`);throw e;}
}
