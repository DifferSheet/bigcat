// User-authorized direct logo compositing. Original poster is preserved.
const sharp = require('sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const source = path.join(__dirname, 'NOBI_26SEP_4x5_proportions-v2.png');
  const {data, info} = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const original = Buffer.from(data);
  // The old generated logo occupies this small, otherwise clear sky area.
  // Interpolate sky from its left/right boundaries, feathering only the perimeter.
  const box = {left:490, right:615, top:5, bottom:85};
  const at = (x,y,c) => (y*info.width+x)*3+c;
  for (let y=box.top;y<=box.bottom;y++) for(let x=box.left;x<=box.right;x++) {
    const t=(x-box.left)/(box.right-box.left);
    const alpha=Math.min(1,(x-box.left)/4,(box.right-x)/4,(y-box.top)/4,(box.bottom-y)/4);
    for(let c=0;c<3;c++) {
      const sky=original[at(box.left,y,c)]*(1-t)+original[at(box.right,y,c)]*t;
      data[at(x,y,c)]=Math.round(original[at(x,y,c)]*(1-alpha)+sky*alpha);
    }
  }
  // Width ONLY: Sharp derives height from the original 1500:1109 aspect ratio.
  const logo=await sharp(path.join(root,'public/images/bigcat-logo-white.png'))
    .resize({width:96}).png().toBuffer();
  const meta=await sharp(logo).metadata();
  // Original logo lettering is transparent cut-out; a dark backing makes it
  // legible on sky without changing any supplied logo contours or letterforms.
  const backing=Buffer.from('<svg width="96" height="71"><rect x="18" y="18" width="60" height="45" rx="7" fill="#171b28"/></svg>');
  const finalLogo=await sharp({create:{width:meta.width,height:meta.height,channels:4,background:'#00000000'}})
    .composite([{input:backing},{input:logo}]).png().toBuffer();
  const output=path.join(__dirname,'NOBI_26SEP_4x5_final-logo.png');
  await sharp(data,{raw:info}).composite([{input:finalLogo,left:513,top:10}]).png().toFile(output);
  await sharp(output).extract({left:460,top:0,width:200,height:145}).resize({width:800}).png()
    .toFile(path.join(__dirname,'NOBI_26SEP_logo-detail.png'));
  const result=await sharp(output).removeAlpha().raw().toBuffer();
  let outsideChanges=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    if(x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom)continue;
    for(let c=0;c<3;c++)if(result[at(x,y,c)]!==original[at(x,y,c)])outsideChanges++;
  }
  if(outsideChanges)throw Error(`Unexpected changes outside logo: ${outsideChanges}`);
  console.log(JSON.stringify({output,logoSize:[meta.width,meta.height],originalRatio:1500/1109,outsideChanges}));
})().catch(e=>{console.error(e);process.exit(1)});
