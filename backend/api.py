from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import io
import torch
from PIL import Image, ImageDraw
from transformers import AutoProcessor, AutoModelForCausalLM 
from simple_lama_inpainting import SimpleLama

app = FastAPI(title="AI Watermark Remover API - Florence 2 & LaMa")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading Models onto {device.upper()}...")

print("1. Loading Microsoft Florence-2-base (Detection)...")
# Using base to save PC RAM. trust_remote_code is required for Florence architectures.
florence_model_id = "microsoft/Florence-2-base"
processor = AutoProcessor.from_pretrained(florence_model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(florence_model_id, trust_remote_code=True).to(device)

print("2. Loading LaMa (Inpainting)...")
lama = SimpleLama()

print("Models loaded successfully!")

def get_mask_for_prompt(image: Image.Image, prompt_text: str) -> Image.Image:
    """Uses Florence-2 to detect the bounding box of the text/watermark and draw a b&w mask"""
    # Open-vocabulary phrase grounding task
    task_prompt = f"<CAPTION_TO_PHRASE_GROUNDING> {prompt_text}"
    
    inputs = processor(text=task_prompt, images=image, return_tensors="pt").to(device)
    
    generated_ids = model.generate(
      input_ids=inputs["input_ids"],
      pixel_values=inputs["pixel_values"],
      max_new_tokens=1024,
      num_beams=3
    )
    
    generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    parsed_answer = processor.post_process_generation(generated_text, task="<CAPTION_TO_PHRASE_GROUNDING>", image_size=(image.width, image.height))
    
    # Create black mask
    mask = Image.new('L', (image.width, image.height), 0)
    draw = ImageDraw.Draw(mask)
    
    # Extract bounding boxes
    boxes_dict = parsed_answer.get('<CAPTION_TO_PHRASE_GROUNDING>', {})
    
    for label, bboxes in boxes_dict.items():
        for box in bboxes:
            x0, y0, x1, y1 = box
            # Generous padding around the watermark for seamless LaMa blending
            pad = 12
            draw.rectangle([x0-pad, y0-pad, x1+pad, y1+pad], fill=255)
            
    return mask

@app.post("/api/auto-clean")
async def auto_clean(
    image: UploadFile = File(...),
    prompt: str = Form("watermark")
):
    try:
        print(f"Request received. Searching for: '{prompt}'")
        
        # 1. Read Image
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 2. Stage 1: Detection
        print("Detecting using Florence-2...")
        mask_img = get_mask_for_prompt(pil_img, prompt)
        
        # 3. Stage 2: Inpainting
        print("Inpainting using LaMa...")
        # simple-lama takes the original image and the binary mask
        clean_img = lama(pil_img, mask_img)
        
        # 4. Return to frontend
        output_buffer = io.BytesIO()
        clean_img.save(output_buffer, format="PNG")
        output_bytes = output_buffer.getvalue()
        
        print("Done! Sending pristine image back.")
        return Response(content=output_bytes, media_type="image/png")

    except Exception as e:
        print(f"ERROR: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=False)
