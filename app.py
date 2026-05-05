from flask import Flask, request, jsonify, send_from_directory
import os
import requests
import json
from dotenv import load_dotenv
import PyPDF2

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    # This was previously a hardcoded local path. 
    # Serving from a generic 'assets' folder in the current directory instead.
    return send_from_directory('assets', filename)

@app.route('/api/generate', methods=['POST'])
def generate():
    if not GROQ_API_KEY:
        return jsonify({"error": "Backend misconfigured: GROQ_API_KEY is not set. Please add it to your .env file."}), 500

    text = ""
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file."}), 400
            
        if file.filename.lower().endswith('.pdf'):
            try:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
            except Exception as e:
                return jsonify({"error": f"Failed to read PDF: {str(e)}"}), 500
        elif file.filename.lower().endswith('.txt'):
            try:
                text = file.read().decode('utf-8')
            except Exception as e:
                return jsonify({"error": f"Failed to read text file: {str(e)}"}), 500
        else:
            return jsonify({"error": "Unsupported file type. Please upload a PDF or TXT file."}), 400
    else:
        data = request.get_json(silent=True)
        if data:
            text = data.get("text", "").strip()

    if not text.strip():
        return jsonify({"error": "No text could be extracted from the input."}), 400

    # System prompt to enforce structured JSON output
    system_prompt = """You are an expert learning assistant. Extract insights from the user's text and output strictly valid JSON with the following structure exactly:
{
  "summary_short": "<p>A concise HTML formatted summary of exactly 7 lines depending on the content</p>",
  "summary_medium": "<p>A medium-length, well-structured HTML formatted summary of exactly 15 lines depending on the content</p>",
  "summary_detailed": "<p>An extensive, highly detailed HTML formatted summary covering all nuances, of exactly 35 lines depending on the content</p>",
  "key_points": ["Key point 1", "Key point 2", "Key point 3"],
  "flashcards": [{"question": "...", "answer": "..."}],
  "qa": [{"question": "...", "answer": "..."}]
}
Generate around 5-10 key points, 5 flashcards, and exactly 5 Q&A pairs based on the text. Do not output anything outside of the JSON."""

    try:
        # Groq API Request using OpenAI compatible endpoint
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                "model": "llama-3.1-8b-instant",
                "response_format": { "type": "json_object" },
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ]
            }
        )

        response.raise_for_status()
        
        result_data = response.json()
        content = result_data['choices'][0]['message']['content']
        
        # Parse the JSON string from the LLM back to a Python dict to ensure it's valid, then return it
        parsed_json = json.loads(content)
        parsed_json['_original_text'] = text
        return jsonify(parsed_json)

    except requests.exceptions.RequestException as e:
        print(f"API Request failed: {e}")
        if response.text:
             print(f"Response data: {response.text}")
        return jsonify({"error": f"Failed to generate insights: {str(e)}"}), 500
    except json.JSONDecodeError:
        return jsonify({"error": "The AI model failed to return a valid JSON structure."}), 500
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

@app.route('/api/generate_more', methods=['POST'])
def generate_more():
    if not GROQ_API_KEY:
        return jsonify({"error": "Backend misconfigured: GROQ_API_KEY is not set."}), 500

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
        
    text = data.get("text", "").strip()
    existing_items = data.get("existing_items", [])
    item_type = data.get("type", "flashcards")
    amount = data.get("amount", 5)
    
    if not text:
        return jsonify({"error": "No text provided."}), 400
        
    if item_type == "flashcards":
        name = "flashcards"
        schema = f'{{"flashcards": [{{"question": "...", "answer": "..."}}]}}'
    else:
        name = "Q&A pairs"
        schema = f'{{"qa": [{{"question": "...", "answer": "..."}}]}}'

    system_prompt = f"""You are an expert learning assistant. The user wants more {name} based on the provided text.
Here are the {name} you already generated:
{json.dumps(existing_items)}

Generate {amount} NEW and DISTINCT {name} based on the text. Do not repeat the existing ones.
Output strictly valid JSON with the following structure exactly:
{schema}
Do not output anything outside of the JSON."""

    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                "model": "llama-3.1-8b-instant",
                "response_format": { "type": "json_object" },
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ]
            }
        )

        response.raise_for_status()
        result_data = response.json()
        content = result_data['choices'][0]['message']['content']
        parsed_json = json.loads(content)
        return jsonify(parsed_json)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to generate more flashcards: {str(e)}"}), 500
    except json.JSONDecodeError:
        return jsonify({"error": "The AI model failed to return a valid JSON structure."}), 500
    except Exception as e:
        return jsonify({"error": "An internal server error occurred."}), 500

if __name__ == '__main__':
    print("Starting NoteForge server on http://localhost:8080")
    app.run(debug=True, port=8080)
