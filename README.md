# BMAV-Central Product Performance Monitor

Online infographic dashboard สำหรับติดตามยอดขายรายวันของพื้นที่ BMAV-Central แบบแยก Product และรายสาขา

- Products: Device, GIA, Postpay และ TrueOnline
- เลือกดูทุกสาขาหรือสาขาเดียวได้
- KPI, กราฟ, อันดับ, Runrate และ Forecast คำนวณเฉพาะ Product ที่เลือก
- ไม่มีการรวมยอดข้าม Product
- ข้อมูลล่าสุด: 1–3 August 2026 จากไฟล์ `8778 Aug 2026 V1.xlsx`
- Runrate ใช้ข้อมูล `RR Net Amount` แยกตาม Product และสาขา

## Online dashboard

- GitHub Pages: https://amnattyy-cyber.github.io/bmav-central-device-performance/

## Update ข้อมูลรายวัน

แก้ไขไฟล์ `app/sales-product-data.json` โดยเพิ่มยอดรายวันใน `daily` ของแต่ละ Product และสาขา จากนั้น push เข้า branch `main` ระบบ GitHub Pages จะ build และเผยแพร่เวอร์ชันใหม่อัตโนมัติ

## ตรวจสอบก่อนเผยแพร่

```bash
npm run build
npm run build:pages
```
