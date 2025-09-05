import sys
import json
from sentence_transformers import SentenceTransformer

def main():
    try:
        # รับข้อความจาก command-line argument
        input_text = sys.argv[1] if len(sys.argv) > 1 else ""
        if not input_text:
            print(json.dumps([]), file=sys.stderr)
            sys.exit(1)

        # โหลดโมเดล
        model = SentenceTransformer('all-MiniLM-L6-v2')
        # สร้าง embedding
        embedding = model.encode(input_text, convert_to_tensor=False).tolist()
        # ส่งคืน embedding เป็น JSON
        print(json.dumps(embedding))
    except Exception as e:
        print(json.dumps([]), file=sys.stderr)
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()