from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import asyncio
import tempfile
import os
from pathlib import Path
import logging
from pydantic import BaseModel
import uuid
from fastapi.middleware.cors import CORSMiddleware
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Summary API",
    description="Upload multiple PDFs and get summaries with titles",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with frontend URL in production, e.g., ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PDFSummary(BaseModel):
    filename: str
    summary: str
    titles: List[str]

class SummaryResponse(BaseModel):
    analysis_id: str
    total_documents: int
    results: List[PDFSummary]
    processing_time: float

llm = ChatOpenAI(
    model_name="gpt-4o-mini",  
    temperature=0.1,
    max_tokens=1000,
)

class PDFAnalyzer:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Simplified prompt for summary and titles only
        self.summary_prompt = ChatPromptTemplate.from_template("""
        You are a document analyzer. Read the following PDF content and provide:

        1. A concise summary (2-3 sentences) of what this document is about
        2. Extract ALL titles, headings, chapter names, section headers you can find

        Document Content:
        {content}

        IMPORTANT: Respond ONLY with valid JSON in exactly this format (no extra text):
        {{
            "summary": "Your 2-3 sentence summary here",
            "titles": ["Title 1", "Title 2", "Title 3"]
        }}
        """)

    async def extract_pdf_content(self, file_path: str) -> List[Document]:
        """Extract content from PDF file"""
        try:
            loader = PyPDFLoader(file_path)
            documents = await asyncio.to_thread(loader.load)
            chunks = self.text_splitter.split_documents(documents)
            return chunks
        except Exception as e:
            logger.error(f"Error extracting PDF content: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

    async def analyze_pdf_content(self, documents: List[Document], filename: str) -> PDFSummary:
        """Analyze PDF content and return summary with titles"""
        try:
            # Combine all content
            full_content = "\n".join([doc.page_content for doc in documents])
            
            # Log content info for debugging
            logger.info(f"Processing {filename}: {len(full_content)} characters, {len(documents)} pages")
            
            # Check if content is empty or too short
            if not full_content.strip():
                logger.warning(f"No content extracted from {filename}")
                return PDFSummary(
                    filename=filename,
                    summary="No readable content found in PDF",
                    titles=[]
                )
            
            if len(full_content.strip()) < 50:
                logger.warning(f"Very little content extracted from {filename}: {len(full_content)} chars")
                return PDFSummary(
                    filename=filename,
                    summary="PDF contains very little readable text",
                    titles=[]
                )
            
            # Truncate if too long to save on tokens
            if len(full_content) > 8000:
                full_content = full_content[:8000] + "\n[Content truncated...]"
            
            # Log first 200 chars for debugging
            logger.info(f"Content preview for {filename}: {full_content[:200]}...")
            
            # Run analysis
            chain = self.summary_prompt | llm
            result = await asyncio.to_thread(
                chain.invoke,
                {"content": full_content}
            )

            logger.info(f"LLM response for {filename}: {result.content}")

            # Parse JSON response
            import json
            try:
                response_text = result.content.strip()
                if response_text.startswith("```json"):
                    response_text = response_text.replace("```json", "").replace("```", "").strip()
                
                analysis_data = json.loads(response_text)
                summary = analysis_data.get("summary", "No summary available")
                titles = analysis_data.get("titles", [])
                
                logger.info(f"Successfully parsed analysis for {filename}")
                
            except json.JSONDecodeError as je:
                logger.error(f"JSON decode error for {filename}: {je}")
                logger.error(f"Raw response: {result.content}")
                
                # Fallback: try to extract summary and titles manually
                response_text = result.content
                summary = "Generated summary parsing failed - check logs"
                titles = []
                
                # Simple fallback extraction
                if "summary" in response_text.lower():
                    lines = response_text.split('\n')
                    for line in lines:
                        if 'summary' in line.lower() and ':' in line:
                            summary = line.split(':', 1)[1].strip(' "')
                            break
            
            return PDFSummary(
                filename=filename,
                summary=summary,
                titles=titles
            )
            
        except Exception as e:
            logger.error(f"Error analyzing PDF content for {filename}: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            return PDFSummary(
                filename=filename,
                summary=f"Error during analysis: {str(e)}",
                titles=[]
            )

# Initialize analyzer
analyzer = PDFAnalyzer()

@app.post("/analyze-pdfs", response_model=SummaryResponse)
async def analyze_pdfs(files: List[UploadFile] = File(...)):
    """
    Upload multiple PDF files and get summaries with titles
    """
    import time
    start_time = time.time()
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Validate file types
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400, 
                detail=f"File {file.filename} is not a PDF"
            )
    
    analysis_id = str(uuid.uuid4())
    results = []
    
    # Create temporary directory for file processing
    with tempfile.TemporaryDirectory() as temp_dir:
        # Process each PDF file
        tasks = []
        
        for file in files:
            # Save uploaded file temporarily
            temp_file_path = os.path.join(temp_dir, file.filename)
            
            with open(temp_file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Create task for processing this file
            task = process_single_pdf(temp_file_path, file.filename)
            tasks.append(task)
        
        # Process all PDFs concurrently
        try:
            pdf_summaries = await asyncio.gather(*tasks, return_exceptions=True)
            
            for summary in pdf_summaries:
                if isinstance(summary, Exception):
                    logger.error(f"Error processing PDF: {str(summary)}")
                    continue
                results.append(summary)
                
        except Exception as e:
            logger.error(f"Error in batch processing: {str(e)}")
            raise HTTPException(status_code=500, detail="Error processing PDFs")
    
    processing_time = time.time() - start_time
    
    return SummaryResponse(
        analysis_id=analysis_id,
        total_documents=len(results),
        results=results,
        processing_time=round(processing_time, 2)
    )

async def process_single_pdf(file_path: str, filename: str) -> PDFSummary:
    """Process a single PDF file"""
    try:
        documents = await analyzer.extract_pdf_content(file_path)
        summary = await analyzer.analyze_pdf_content(documents, filename)
        return summary
        
    except Exception as e:
        logger.error(f"Error processing {filename}: {str(e)}")
        return PDFSummary(
            filename=filename,
            summary=f"Failed to process: {str(e)}",
            titles=[]
        )

@app.get("/")
async def root():
    return {
        "message": "PDF Summary API",
        "endpoints": {
            "analyze": "/analyze-pdfs (POST) - Upload PDFs to get summaries and titles"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )