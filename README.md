# BMAV-Central Product Performance Monitor

Online infographic dashboard สำหรับติดตามยอดขายรายวันของพื้นที่ BMAV-Central แบบแยก Product และรายสาขา

- Products: Device, GIA, Postpay และ TrueOnline
- เลือกดูทุกสาขาหรือสาขาเดียวได้
- KPI, กราฟ, อันดับ, Runrate และ Forecast คำนวณเฉพาะ Product ที่เลือก
- ไม่มีการรวมยอดข้าม Product
- ข้อมูลยอดขายล่าสุด: ถึงวันที่ 12 August 2026 จากไฟล์ `8778 Aug 2026 V1.xlsx`
- Runrate ใช้ข้อมูล `RR Net Amount` แยกตาม Product และสาขา
- Performance Indy รายบุคคล: Postpay ถึง 09/08/2026 และ TOL ถึง 10/08/2026 จาก Google Sheet `BMAV Person Performance Daily Update`

## Online dashboard

- GitHub Pages: https://amnattyy-cyber.github.io/bmav-central-device-performance/

## Update ข้อมูลรายวัน

Dashboard ดึงข้อมูลจาก Google Sheet `BMAV-Central Dashboard Auto Sync` เมื่อเปิดหน้าเว็บ และตรวจข้อมูลใหม่ทุก 5 นาที

- แท็บที่ใช้: `Dashboard_Data`
- กรอกยอดในคอลัมน์ `Day01`–`Day31`
- อัปเดต `AsOf` ให้เป็นวันที่ข้อมูลล่าสุด
- ห้ามเปลี่ยนชื่อแท็บหรือชื่อหัวคอลัมน์
- หาก Google Sheet ใช้งานไม่ได้ Dashboard จะใช้ `app/sales-product-data.json` เป็นข้อมูลสำรอง

## ตรวจสอบก่อนเผยแพร่

```bash
npm run build
npm run build:pages
```
