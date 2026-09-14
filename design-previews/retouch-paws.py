"""User-authorized deterministic raster retouch; originals are preserved."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
desktop = Image.open(ROOT / 'design-previews/housewarming-paws-review-desktop.png').convert('RGB')
mobile = Image.open(ROOT / 'public/images/cozy/housewarming-cute-mobile.png').convert('RGB')

def contact(img, boxes, name):
    sheet = Image.new('RGB', (len(boxes)*240, 240), 'white')
    for i, box in enumerate(boxes):
        sheet.paste(img.crop(box).resize((240,240)), (i*240,0))
    sheet.save(ROOT / 'design-previews' / name)

contact(desktop, [(550,415,645,510),(830,500,920,590),(913,470,995,551),(1190,528,1267,605),(1260,570,1340,650),(1535,435,1623,521)], 'paws-desktop-detail.png')
contact(mobile, [(42,932,105,995),(296,1005,350,1067),(350,984,401,1038),(591,1036,641,1090),(644,1065,698,1120),(875,962,937,1020)], 'paws-mobile-detail.png')

def heal(img, ellipse):
    # Harmonic interpolation from surrounding original pixels, confined to mask.
    x0,y0,x1,y1 = ellipse
    box = (max(0,x0-4),max(0,y0-4),x1+5,y1+5)
    a = np.array(img.crop(box), dtype=np.float64)
    mask = Image.new('L', (a.shape[1],a.shape[0]))
    ImageDraw.Draw(mask).ellipse((x0-box[0],y0-box[1],x1-box[0],y1-box[1]), fill=255)
    m = np.array(mask)>0
    a[m] = a[~m].mean(axis=0)
    for _ in range(1800):
        avg = (np.roll(a,1,0)+np.roll(a,-1,0)+np.roll(a,1,1)+np.roll(a,-1,1))/4
        a[m] = avg[m]
    img.paste(Image.fromarray(np.uint8(np.clip(a,0,255))), box[:2])

heal(desktop, (838,530,858,548))
heal(desktop, (1537,470,1558,490))
# Clone one existing gray fingertip, including its original highlight.
dot = desktop.crop((1224,536,1241,553))
mask = Image.new('L', dot.size)
ImageDraw.Draw(mask).ellipse((1,1,15,15), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(.65))
desktop.paste(dot, (1243,572), mask)

for box in [(60,974,77,991),(313,1053,329,1068),(607,1076,622,1091),(665,1107,682,1123),(904,1003,923,1020)]:
    heal(mobile, box)

# Transfer only expression ink/tongue, not face shape or surrounding cream.
heal(mobile, (151,888,192,936))
heal(mobile, (193,950,239,976))
heal(mobile, (191,947,202,959))
heal(mobile, (163,884,176,895))
def expression(source_box, destination, size, angle):
    patch = desktop.crop(source_box).convert('RGBA')
    a = np.array(patch)
    # Dark eyelid/mouth and saturated pink tongue; reject cream face pixels.
    yy = np.indices(a.shape[:2])[0]
    keep = (a[:,:,0]<145) | ((a[:,:,0]>a[:,:,1]*1.45)&(a[:,:,1]<150)&(yy>15))
    alpha = Image.fromarray(np.uint8(keep)*255).filter(ImageFilter.GaussianBlur(.35))
    patch.putalpha(alpha)
    patch = patch.resize(size, Image.Resampling.LANCZOS).rotate(angle, Image.Resampling.BICUBIC, expand=True)
    mobile.paste(patch, destination, patch)

expression((679,376,735,416), (150,894), (44,32), -10)
expression((734,437,788,484), (195,948), (42,37), -10)
desktop.save(ROOT / 'public/images/cozy/housewarming-four-paws-desktop.png')
mobile.save(ROOT / 'public/images/cozy/housewarming-four-paws-mobile.png')
contact(desktop, [(550,415,645,510),(830,500,920,590),(913,470,995,551),(1190,528,1267,605),(1260,570,1340,650),(1535,435,1623,521)], 'paws-desktop-after.png')
contact(mobile, [(42,932,105,995),(296,1005,350,1067),(350,984,401,1038),(591,1036,641,1090),(644,1065,698,1120),(875,962,937,1020)], 'paws-mobile-after.png')
mobile.crop((105,850,305,1010)).resize((600,480)).save(ROOT / 'design-previews/nobi-expression-after.png')
