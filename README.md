# Food Menu Planner Frontend

โปรเจกต์นี้เป็น frontend สำหรับ deploy บน Cloudflare Pages หรือ Netlify โดยทำงานร่วมกับ Google Sheets ผ่าน Google Apps Script web app

## โครงสร้าง

- `index.html` หน้าแอปหลัก
- `styles.css` style ทั้งระบบ
- `app.js` logic ฝั่ง frontend
- `data/menu-data.json` ข้อมูลตั้งต้นสำหรับ fallback

## วิธีใช้งานร่วมกับ Google Sheet backend

1. Deploy โฟลเดอร์นี้ขึ้น Cloudflare Pages
2. Deploy โฟลเดอร์ `food-menu-app` เป็น Google Apps Script web app
3. เปิดหน้าเว็บที่ deploy แล้ว
4. วาง `Apps Script Web App URL` ลงในกล่องบนหน้าแรก
5. กด `เชื่อม Google Sheet`

เมื่อเชื่อมสำเร็จ:

- โหลดเมนูและวัตถุดิบจาก Google Sheet
- เพิ่มหรือแก้เมนูแล้วข้อมูลจะไม่หายหลัง deploy ใหม่
- บันทึกออเดอร์รายวันลง Google Sheet ได้

## ถ้ายังไม่เชื่อม backend

แอปจะ fallback ไปใช้ข้อมูลในเครื่องชั่วคราวผ่าน `localStorage`

## Deploy บน Cloudflare Pages

ค่าพื้นฐานที่ใช้ได้:

- `Framework preset`: `None`
- `Build command`: เว้นว่าง หรือ `exit 0`
- `Build output directory`: `.`

## หมายเหตุ

- หาก Apps Script URL เปลี่ยน ให้ paste URL ใหม่แล้วกดเชื่อมอีกครั้ง
- ถ้าเชื่อมไม่สำเร็จ แอปจะยังเปิดได้ แต่จะกลับไปใช้ข้อมูลในเครื่องแทน
