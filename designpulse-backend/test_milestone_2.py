import sys
import os
import asyncio
from dotenv import load_dotenv

# Load env before importing main to ensure Supabase client initializes
load_dotenv()

from main import supabase
from services.tile_processor import TileProcessor
from services.vector_extractor import VectorExtractor

def run_tests():
    try:
        if not os.path.exists("dummy.pdf"):
            print("FAILED: dummy.pdf not found in directory.")
            return

        with open("dummy.pdf", "rb") as f:
            pdf_bytes = f.read()
            
        print("--- STARTING MILESTONE 2 VERIFICATION ---")
        sheet_id = "ai-verification-test-sheet"

        print(f"1. Testing TileProcessor (pyvips -> Supabase bucket)...")
        max_zoom, width, height = TileProcessor.process_pdf_to_tiles(pdf_bytes, sheet_id, supabase)
        print(f"   [OK] TileProcessor successful!")
        print(f"   [OK] Max Zoom: {max_zoom}")
        print(f"   [OK] Original Dimensions: {width}x{height}")

        print(f"2. Testing VectorExtractor (PyMuPDF -> Supabase bucket)...")
        VectorExtractor.extract_and_upload(pdf_bytes, sheet_id, supabase)
        print(f"   [OK] VectorExtractor successful! vectors.json uploaded.")

        print("\n--- ALL VERIFICATION TESTS PASSED ---")
        
        # Cleanup test data from bucket
        print("Cleaning up test artifacts from Supabase...")
        try:
            # We would list and delete, but Supabase python client doesn't recursively delete folders easily
            # We will just delete the vectors.json
            supabase.storage.from_("project_drawings").remove([f"{sheet_id}/vectors.json"])
            print("Cleanup finished.")
        except:
            pass

    except Exception as e:
        print(f"\n[ERROR] VERIFICATION FAILED: {str(e)}")

if __name__ == "__main__":
    run_tests()
