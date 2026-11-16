// 用户授权的确定性后处理：不重画角色，保留候选源图。
const fs=require('node:fs'),path=require('node:path');
const sharp=require(process.env.GPT_ART_SHARP_MODULE || 'sharp');
const iq=require(process.env.GPT_ART_IMAGE_Q_MODULE || 'image-q');
const root=path.resolve(__dirname,'../..');
const batch=[
 ['qinglong','20261113/qinglong-form1.png','pets/qinglong/form1.png'],
 ['baihu','20261116/baihu-form1.png','pets/baihu/form1.png'],
 ['zhuque','20261116/zhuque-form1.png','pets/zhuque/form1.png'],
 ['xuanwu','20261116/xuanwu-obsidian-form1.png','pets/xuanwu/form1.png'],
 ['yinyu','20261116/yinyu-blackgold-form1.png','pets/yinyu/form1.png'],
 ['yangyu','20261116/yangyu-form1.png','pets/yangyu/form1.png'],
 ['base_m','20261113/base_m-plain.png','characters/base_m.png',true],
 ['base_f','20261113/base_f-plain.png','characters/base_f.png',true],
 ['outfit_m','20261113/outfit_m.png','art-delivery/20261116/outfit_m.png',true],
 ['outfit_f','20261113/outfit_f.png','art-delivery/20261116/outfit_f.png',true],
];
function clean(data,w,h){
 // 去掉低透明度光晕；半透明过渡保留为平滑alpha。
 for(let k=3;k<data.length;k+=4)data[k]=data[k]<128?0:255;
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let largest=0;const comps=[];
 for(let p=0;p<w*h;p++){if(visited[p]||!data[p*4+3])continue;let head=0,tail=1;queue[0]=p;visited[p]=1;const pixels=[];
  while(head<tail){let x=queue[head++];pixels.push(x);for(const n of [x-w,x+w,x%w?x-1:-1,x%w<w-1?x+1:-1])if(n>=0&&n<w*h&&!visited[n]&&data[n*4+3]){visited[n]=1;queue[tail++]=n}}
  largest=Math.max(largest,pixels.length);comps.push(pixels);
 }
 // 小散点不属于主体；保留珠子、分离羽尖等有意义的独立部分。
 for(const comp of comps)if(comp.length<Math.max(20,largest*.00008))for(const p of comp)data[p*4+3]=0;
 for(let k=0;k<data.length;k+=4)if(data[k+3]===0)data.fill(0,k,k+4);
 return data;
}
(async()=>{
 const report=[],tiles=[];
 for(const [id,src,dst,character] of batch){
  const source=path.join(root,'public/art-review',src);const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});clean(data,info.width,info.height);
  const cropped=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).trim({background:'#00000000',threshold:0}).png().toBuffer();
  const W=1024,H=character?1536:1024,target=Math.round(H*.72),bottom=Math.round(H*.08);
  const resized=await sharp(cropped).resize({width:Math.round(W*.88),height:target,fit:'inside'}).toBuffer();const size=await sharp(resized).metadata();
  const canvas=await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input:resized,left:Math.round((W-size.width)/2),top:H-bottom-size.height}]).png().toBuffer();
  let output,colors,quality='nearest-palette';
  // 最终仍输出8-bit RGBA (PNG color type 6)，不是索引PNG；只量化颜色以压缩。
  const canvasRaw=await sharp(canvas).ensureAlpha().raw().toBuffer();
  for(let k=0;k<canvasRaw.length;k+=4){let a=canvasRaw[k+3];canvasRaw[k+3]=a<16?0:a>239?255:Math.round(a/16)*16;if(!canvasRaw[k+3])canvasRaw.fill(0,k,k+4)}
  console.log('canvas',id,[...canvasRaw.subarray(0,4)]);
  for(colors of [128,96,64,48,32,24,16]){const points=iq.utils.PointContainer.fromUint8Array(canvasRaw,W,H);const palette=iq.buildPaletteSync([points],{colors,paletteQuantization:'wuquant'});const mapped=iq.applyPaletteSync(points,palette,{imageQuantization:'nearest'});const raw=Buffer.from(mapped.toUint8Array());for(let k=0;k<raw.length;k+=4){raw[k+3]=canvasRaw[k+3];if(!raw[k+3])raw.fill(0,k,k+4)}output=await sharp(raw,{raw:{width:W,height:H,channels:4}}).png({palette:false,compressionLevel:9,adaptiveFiltering:false}).toBuffer();console.log(id,colors,output.length);if(output.length<=250000)break}
  if(output.length>250000)throw Error(id+' over size budget');
  const dest=path.join(root,'public',dst);if(fs.existsSync(dest)&&!process.argv.includes('--replace-owned'))throw Error('Existing target: '+dest);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output);
  const pix=await sharp(output).ensureAlpha().raw().toBuffer();let minA=255,maxA=0,minX=W,minY=H,maxX=0,maxY=0,border=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=pix[(y*W+x)*4+3];minA=Math.min(minA,a);maxA=Math.max(maxA,a);if(a){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x===0||y===0||x===W-1||y===H-1)border++}}
  report.push({id,source:'public/art-review/'+src,path:'public/'+dst,width:W,height:H,bytes:output.length,colors,quality,alpha:[minA,maxA],bounds:[minX,minY,maxX+1,maxY+1],subjectHeight:(maxY-minY+1)/H,bottomMargin:(H-maxY-1)/H,nonTransparentBorderPixels:border,pngColorType:output[25]});
  const thumb=await sharp(output).resize({width:220,height:240,fit:'inside'}).toBuffer();const meta=await sharp(thumb).metadata();
  for(const bg of ['#f5f6f4','#202927'])tiles.push(await sharp({create:{width:260,height:290,channels:3,background:bg}}).composite([{input:thumb,left:Math.round((260-meta.width)/2),top:20}]).png().toBuffer());
  fs.mkdirSync(path.join(root,'docs/art/delivery-20261116/64px'),{recursive:true});await sharp(output).resize(64,64,{fit:'inside'}).png().toFile(path.join(root,'docs/art/delivery-20261116/64px',id+'.png'));
 }
 const out=path.join(root,'docs/art/delivery-20261116');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2));
 await sharp({create:{width:1040,height:Math.ceil(tiles.length/4)*290,channels:3,background:'#d5dad5'}}).composite(tiles.map((input,i)=>({input,left:(i%4)*260,top:Math.floor(i/4)*290}))).png().toFile(path.join(out,'light-dark-contact-sheet.png'));
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
