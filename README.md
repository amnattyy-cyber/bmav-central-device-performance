# BMAV-Central Product Performance Monitor

Online infographic dashboard สำหรับติดตามยอดขายรายวันของพื้นที่ BMAV-Central แบบแยก Product และรายสาขา

- Products: Device, GIA, Postpay และ TrueOnline
- เลือกเดือนและมุมยอดขาย `Net Amount / Revenue` หรือ `QTY / จำนวน Sub` ได้ตามข้อมูลของแต่ละ Product
- เลือกดูทุกสาขาหรือสาขาเดียวได้
- KPI, กราฟ, อันดับ, Runrate, Forecast, MoM และ WoW คำนวณเฉพาะเดือน Product และมุมยอดขายที่เลือก
- ไม่มีการรวมยอดข้าม Product
- รองรับข้อมูล August และ September 2026 โดย Week นับต่อเนื่องตั้งแต่ W32 ถึง W40
- Runrate ใช้ข้อมูล `RR Net Amount` แยกตาม Product และสาขา
- Performance Indy รายบุคคล: Postpay ถึง 09/08/2026 และ TOL ถึง 10/08/2026 จาก Google Sheet `BMAV Person Performance Daily Update`

## Online dashboard

- GitHub Pages: https://amnattyy-cyber.github.io/bmav-central-device-performance/

## Update ข้อมูลรายวัน

Dashboard ดึงข้อมูลจาก Google Sheet `BMAV-Central Dashboard Auto Sync` เมื่อเปิดหน้าเว็บ และตรวจข้อมูลใหม่ทุก 5 นาที

- แท็บที่ใช้: `Dashboard_Data`
- กรอกยอดรายวันในแท็บ `Daily_Update`: Device Net, GIA Net, Postpay Net, TOL QTY, Device QTY, GIA QTY, Postpay QTY และ TOL Net
- `Dashboard_Data` จะคำนวณยอดรายเดือนและ `AsOf` จากวันที่ที่กรอกครบทุกสาขา
- เดือน September ใช้ QTY เป็นจำนวน Sub และ TOL Net เป็น Revenue
- ห้ามเปลี่ยนชื่อแท็บหรือชื่อหัวคอลัมน์
- หาก Google Sheet ใช้งานไม่ได้ Dashboard จะใช้ `app/sales-product-data.json` เป็นข้อมูลสำรอง

## ตรวจสอบก่อนเผยแพร่

```bash
npm run build
npm run build:pages
```
