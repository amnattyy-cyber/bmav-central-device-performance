# Focus Device By Brand

แดชบอร์ดสาธารณะสำหรับติดตามยอดขาย Device แยกตามแบรนด์ของพื้นที่ BMAV-Central โดยใช้ข้อมูล Run Rate (RR NET AMOUNT / RR QTY) เพื่อวัด `%Ach` และ `MOM`

- Live dashboard: https://bmav-central-device-jul26.amnattyy.chatgpt.site
- ข้อมูลปัจจุบัน: As of 30 July 2026
- ขอบเขต: 15 สาขาที่มี Target

## เกณฑ์จัดกลุ่มสาขา

- ทำผลงานดี: `%Ach >= 90%`
- ควรเร่งติดตาม: `%Ach 50-89.9%`
- เฝ้าระวัง: `%Ach < 50%` หรือ `MOM ลดลงตั้งแต่ 20%`
- ขายไม่ได้: มี Target แต่ `RR = 0`

## การอัปเดตรายวัน

ไฟล์ต้นทางแต่ละวันจัดเก็บไว้ในโฟลเดอร์ `data/` โดยใช้ชื่อวันที่ของข้อมูล จากนั้นอัปเดตข้อมูลที่ผ่านการตรวจสอบใน `app/sales-analysis.json`, ทดสอบ Dashboard และเผยแพร่เวอร์ชันใหม่ทั้งบน GitHub และเว็บไซต์สาธารณะ

## เริ่มใช้งานในเครื่อง

ต้องใช้ Node.js เวอร์ชัน `22.13.0` ขึ้นไป

```bash
npm install
npm run dev
```

ตรวจสอบก่อนเผยแพร่ด้วยคำสั่ง:

```bash
npm run build
```
