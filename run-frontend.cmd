@echo off
cd /d D:\Whatsapp_Message_Sender_Full_Stack\frontend
set NODE_OPTIONS=--max-old-space-size=512
"D:\Node\node.exe" "D:\Whatsapp_Message_Sender_Full_Stack\frontend\node_modules\next\dist\bin\next" start --hostname 0.0.0.0 --port 3000
