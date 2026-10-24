import AppKit
struct Entry: Codable { let name: String; let serving: String?; let price: Int? }
struct Fixture: Codable { let id: String; let label: String; let expected: [Entry]; let parseable: Bool }
let entries = [Entry(name:"글렌피딕 12년",serving:"30ml",price:15000),Entry(name:"클라우디 베이 소비뇽 블랑 2024",serving:nil,price:90000),Entry(name:"Sierra Nevada Pale Ale",serving:"330ml",price:9000),Entry(name:"화요 25",serving:"375ml",price:25000),Entry(name:"메이커스 마크",serving:"30ml",price:12000),Entry(name:"Guinness Draught",serving:"500ml",price:9000)]
let configs:[(String,String)] = [("light","밝은 배경"),("dark","어두운 배경"),("small","작은 글씨"),("dense","촘촘한 12항목"),("two-columns","두 열 메뉴"),("offset-price","가격이 다음 줄"),("landscape","가로 메뉴"),("downscale","큰 원본 축소"),("low-contrast","약한 대비"),("serif","세리프 영문"),("wrapped","줄바꿈 이름"),("skew","8도 기울임"),("no-price","가격 없음"),("ambiguous-price","잔·병 두 가격")]
let root=CommandLine.arguments[1]
var fixtures:[Fixture]=[]
for (kind,label) in configs {
 let width:CGFloat = kind=="landscape" ? 1800 : kind=="downscale" ? 2400 : 1200
 let height:CGFloat = kind=="landscape" ? 1100 : kind=="downscale" ? 3200 : 1600
 let scale:CGFloat=kind=="downscale" ? 2 : 1
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:Int(width),pixelsHigh:Int(height),bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)!
 let bg:CGFloat=kind=="dark" ? 0.08 : kind=="low-contrast" ? 0.84 : 1
 NSColor(white:bg,alpha:1).setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:width,height:height)).fill()
 let color=NSColor(white:kind=="dark" ? 0.96 : kind=="low-contrast" ? 0.52 : 0.05,alpha:1)
 if kind=="skew" {var t=AffineTransform(translationByX:width/2,byY:height/2);t.rotate(byDegrees:8);t.translate(x:-width/2,y:-height/2);(t as NSAffineTransform).concat()}
 let title:[NSAttributedString.Key:Any]=[.font:NSFont.systemFont(ofSize:44*scale,weight:.bold),.foregroundColor:color]
 ("SYNTHETIC TEST MENU" as NSString).draw(at:NSPoint(x:80*scale,y:height-130*scale),withAttributes:title)
 let list=kind=="dense" ? entries+entries : entries
 let fontSize:CGFloat=(kind=="small" ? 23 : kind=="two-columns" ? 25 : kind=="dense" ? 30 : kind=="wrapped" ? 38 : 34)*scale
 let font=kind=="serif" ? NSFont(name:"Georgia",size:fontSize)! : NSFont.systemFont(ofSize:fontSize)
 let style=NSMutableParagraphStyle();style.lineBreakMode = .byWordWrapping
 let attrs:[NSAttributedString.Key:Any]=[.font:font,.foregroundColor:color,.paragraphStyle:style]
 for (index,entry) in list.enumerated(){
  let two=kind=="two-columns",row=two ? index%3 : index,col=two ? index/3 : 0
  let step:CGFloat=kind=="dense" ? 100 : kind=="landscape" ? 125 : two ? 330 : 200
  let x=80*scale+CGFloat(col)*580*scale,y=height-270*scale-CGFloat(row)*step*scale
  let nameText=entry.name+(entry.serving.map{" "+$0} ?? "")
  let nameWidth:CGFloat=(two ? 350 : kind=="wrapped" ? 450 : width/scale-360)*scale
  (nameText as NSString).draw(in:NSRect(x:x,y:y-85*scale,width:nameWidth,height:120*scale),withAttributes:attrs)
  if kind != "no-price",let price=entry.price {
   let formatter=NumberFormatter();formatter.numberStyle = .decimal;formatter.locale=Locale(identifier:"en_US")
   let text=formatter.string(from:NSNumber(value:price))!+"원"+(kind=="ambiguous-price" ? " / 150,000원" : "")
   let px:CGFloat=two ? x+360*scale : width-(kind=="ambiguous-price" ? 490 : 270)*scale
   (text as NSString).draw(at:NSPoint(x:px,y:kind=="offset-price" ? y-110*scale : y),withAttributes:attrs)
  }
 }
 NSGraphicsContext.restoreGraphicsState()
 let data=bitmap.representation(using:.png,properties:[:])!
 try data.write(to:URL(fileURLWithPath:root+"/"+kind+".png"))
 fixtures.append(Fixture(id:kind,label:label,expected:list.map{Entry(name:$0.name,serving:$0.serving,price:kind=="no-price" ? nil : $0.price)},parseable:!["offset-price","no-price","ambiguous-price"].contains(kind)))
}
let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys,.withoutEscapingSlashes]
try encoder.encode(fixtures).write(to:URL(fileURLWithPath:root+"/manifest.json"))
