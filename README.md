# Netlify Menu App

เวอร์ชันนี้เป็น static web app สำหรับโยนขึ้น Netlify โดยเน้นโหลดเร็วและหน้าตาคล้ายเมนูร้านอาหาร

## จุดเด่น

- เปิดมาจะเจอเมนูอาหารก่อน
- ใช้ไฟล์ JSON local ทำให้โหลดเร็วกว่าเวอร์ชัน Apps Script
- รูปใช้ `loading="lazy"` และ `decoding="async"`
- ไม่มี `google.script.run` จึงเหมาะกับ static hosting

## วิธี deploy บน Netlify

1. เปิด [Netlify](https://www.netlify.com/)
2. ลากทั้งโฟลเดอร์ `netlify-menu-app` ขึ้นหน้า deploy
3. หรือเชื่อมกับ Git repo แล้วตั้ง publish directory เป็น `netlify-menu-app`

## ถ้าจะเปลี่ยนข้อมูลเมนู

แก้ไฟล์:

- `data/menu-data.json`

## ข้อสำคัญ

เวอร์ชันนี้ยังไม่ได้เขียนกลับ Google Sheets โดยตรง

ถ้าต้องการทั้ง:

- host บน Netlify
- และแก้ข้อมูลแล้ว sync เข้า Google Sheets

ต้องมี backend API เพิ่มอีกชั้น เช่น:

1. Apps Script API
2. Netlify Functions
3. Supabase / Firebase / SheetDB

ถ้าต้องการ ผมช่วยทำ phase ต่อไปให้เป็น `Netlify + Google Sheets API bridge` ได้
