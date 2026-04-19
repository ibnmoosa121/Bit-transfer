@echo off
echo Starting AI Watermark Remover API on Port 8001...
cd backend
python -m uvicorn api:app --host 0.0.0.0 --port 8001 --reload
pause
